
-- ============================================================
-- Migration consolidata: elementi mancanti BuzzFinder Studio
-- ============================================================

-- ── 1. Nuove tabelle ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sender_daily_stats (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.sender_pool(id) ON DELETE CASCADE,
  giorno    DATE NOT NULL DEFAULT CURRENT_DATE,
  inviati   INTEGER DEFAULT 0,
  aperti    INTEGER DEFAULT 0,
  cliccati  INTEGER DEFAULT 0,
  bounce    INTEGER DEFAULT 0,
  spam      INTEGER DEFAULT 0,
  UNIQUE (sender_id, giorno)
);
ALTER TABLE public.sender_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns sender_daily_stats" ON public.sender_daily_stats
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sender_pool sp WHERE sp.id = sender_daily_stats.sender_id AND sp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sender_pool sp WHERE sp.id = sender_daily_stats.sender_id AND sp.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.email_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.campaign_step_executions(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('open','click','bounce','spam','unsubscribe')),
  url          TEXT,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_events_execution ON public.email_events(execution_id);
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns email_events" ON public.email_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaign_step_executions cse JOIN public.campaigns c ON c.id = cse.campaign_id WHERE cse.id = email_events.execution_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_step_executions cse JOIN public.campaigns c ON c.id = cse.campaign_id WHERE cse.id = email_events.execution_id AND c.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.unsubscribes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  email       TEXT,
  telefono    TEXT,
  motivo      TEXT DEFAULT 'unsubscribed',
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unsubscribes_email ON public.unsubscribes(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unsubscribes_telefono ON public.unsubscribes(telefono) WHERE telefono IS NOT NULL;
ALTER TABLE public.unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns unsubscribes" ON public.unsubscribes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 2. Colonne mancanti ──────────────────────────────────────

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_note TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risposta_at TIMESTAMPTZ;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ai_intro TEXT,
  ADD COLUMN IF NOT EXISTS ai_personalizzato_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_modello TEXT,
  ADD COLUMN IF NOT EXISTS email_validato BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_validato_at TIMESTAMPTZ;

ALTER TABLE public.scraping_sessions
  ADD COLUMN IF NOT EXISTS pausa_motivo TEXT;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS stop_su_disiscrizione BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tracking_click BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS custom_tracking_domain TEXT;

-- ── 3. Funzioni ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_step_stat(
  p_step_id UUID,
  p_column  TEXT,
  p_amount  INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  v_sql TEXT;
  allowed_columns TEXT[] := ARRAY['stat_inviati','stat_aperti','stat_cliccati','stat_risposte'];
BEGIN
  IF NOT (p_column = ANY(allowed_columns)) THEN
    RAISE EXCEPTION 'Colonna non consentita: %', p_column;
  END IF;
  v_sql := format('UPDATE public.campaign_steps SET %I = %I + $1 WHERE id = $2', p_column, p_column);
  EXECUTE v_sql USING p_amount, p_step_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.calculate_health_score(
  p_bounce_rate NUMERIC,
  p_spam_rate   NUMERIC
) RETURNS INTEGER AS $$
DECLARE score INTEGER := 100;
BEGIN
  score := score - LEAST(FLOOR(p_bounce_rate * 100 * 2)::INTEGER, 60);
  score := score - LEAST(FLOOR(p_spam_rate * 100 * 5)::INTEGER, 30);
  RETURN GREATEST(score, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 4. Trigger: health score ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_health_score() RETURNS TRIGGER AS $$
BEGIN
  NEW.health_score := public.calculate_health_score(COALESCE(NEW.bounce_rate, 0), COALESCE(NEW.spam_rate, 0));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_health_score ON public.sender_pool;
CREATE TRIGGER trigger_update_health_score
  BEFORE UPDATE ON public.sender_pool
  FOR EACH ROW
  WHEN (OLD.bounce_rate IS DISTINCT FROM NEW.bounce_rate OR OLD.spam_rate IS DISTINCT FROM NEW.spam_rate)
  EXECUTE FUNCTION public.update_health_score();

-- ── 5. Trigger: sync risposta ────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_risposta_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.replied_at IS NOT NULL AND (OLD.replied_at IS NULL) THEN
    UPDATE public.campaign_recipients
    SET risposta_at = NEW.replied_at
    WHERE id = NEW.recipient_id AND risposta_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_risposta_at ON public.campaign_step_executions;
CREATE TRIGGER trigger_sync_risposta_at
  AFTER UPDATE ON public.campaign_step_executions
  FOR EACH ROW
  WHEN (NEW.replied_at IS DISTINCT FROM OLD.replied_at)
  EXECUTE FUNCTION public.sync_risposta_at();
