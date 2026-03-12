
-- ============================================================
-- Migration: ElevenLabs AI Calls + Automation Rules Engine
-- ============================================================

-- ─── 1. Extend sender_pool for calls ────────────────────────
ALTER TABLE public.sender_pool
  DROP CONSTRAINT IF EXISTS sender_pool_tipo_check;

ALTER TABLE public.sender_pool
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS elevenlabs_phone_id TEXT,
  ADD COLUMN IF NOT EXISTS phone_number        TEXT,
  ADD COLUMN IF NOT EXISTS chiamate_oggi       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_chiamate_day    INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS durata_media_sec    INTEGER DEFAULT 0;

-- ─── 2. call_sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id             UUID NOT NULL,
  campaign_id         UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  contact_id          UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  recipient_id        UUID REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  execution_id        UUID REFERENCES public.campaign_step_executions(id) ON DELETE SET NULL,
  automation_rule_id  UUID,
  elevenlabs_call_id  TEXT UNIQUE,
  agent_id            TEXT NOT NULL,
  phone_number_from   TEXT,
  phone_number_to     TEXT NOT NULL,
  stato               TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (stato IN (
                        'scheduled','calling','completed','no_answer',
                        'busy','failed','voicemail','cancelled'
                      )),
  scheduled_at        TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  durata_secondi      INTEGER,
  trascrizione        TEXT,
  riassunto_ai        TEXT,
  sentiment           TEXT CHECK (sentiment IN ('positivo','neutro','negativo')),
  esito               TEXT CHECK (esito IN ('interessato','non_interessato','richiama','appuntamento','da_analizzare','altro')),
  data_richiamo       TIMESTAMPTZ,
  note_ai             TEXT,
  costo_eur           NUMERIC(8, 4) DEFAULT 0,
  minuti_fatturati    NUMERIC(6, 2) DEFAULT 0,
  error_message       TEXT,
  recording_url       TEXT
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_contact ON public.call_sessions(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_campaign ON public.call_sessions(campaign_id, stato);
CREATE INDEX IF NOT EXISTS idx_call_sessions_scheduled ON public.call_sessions(stato, scheduled_at) WHERE stato = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_call_sessions_elevenlabs_id ON public.call_sessions(elevenlabs_call_id);

-- ─── 3. automation_rules ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL,
  nome            TEXT NOT NULL,
  descrizione     TEXT,
  attiva          BOOLEAN NOT NULL DEFAULT true,
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  trigger_tipo    TEXT NOT NULL
                  CHECK (trigger_tipo IN (
                    'email_aperta','email_cliccata','risposta_ricevuta',
                    'risposta_etichetta','no_risposta_dopo','pipeline_stage_cambiato',
                    'chiamata_completata','chiamata_esito','contatto_aggiunto',
                    'campagna_avviata','manuale'
                  )),
  trigger_params  JSONB NOT NULL DEFAULT '{}',
  condizioni      JSONB NOT NULL DEFAULT '[]',
  azione_tipo     TEXT NOT NULL
                  CHECK (azione_tipo IN (
                    'chiama_contatto','aggiungi_a_sequenza','cambia_pipeline_stage',
                    'invia_email','assegna_tag','notifica_slack',
                    'notifica_webhook','aspetta_e_poi'
                  )),
  azione_params   JSONB NOT NULL DEFAULT '{}',
  max_esecuzioni_per_contatto  INTEGER DEFAULT 1,
  cooldown_ore                 INTEGER DEFAULT 24,
  volte_eseguita  BIGINT NOT NULL DEFAULT 0,
  ultima_esecuzione TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_attiva ON public.automation_rules(attiva, trigger_tipo);
CREATE INDEX IF NOT EXISTS idx_automation_rules_campaign ON public.automation_rules(campaign_id);

-- ─── 4. automation_executions ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID NOT NULL,
  rule_id         UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  stato           TEXT NOT NULL DEFAULT 'pending'
                  CHECK (stato IN ('pending','running','completed','failed','skipped')),
  trigger_contesto JSONB DEFAULT '{}',
  azione_risultato JSONB DEFAULT '{}',
  error_message   TEXT,
  completato_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON public.automation_executions(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_executions_contact ON public.automation_executions(contact_id, created_at DESC);

-- FK call_sessions -> automation_rules
ALTER TABLE public.call_sessions
  ADD CONSTRAINT fk_call_sessions_automation
  FOREIGN KEY (automation_rule_id)
  REFERENCES public.automation_rules(id) ON DELETE SET NULL;

-- ─── 5. Extend campaign_steps for calls ─────────────────────
ALTER TABLE public.campaign_steps
  DROP CONSTRAINT IF EXISTS campaign_steps_tipo_check;

ALTER TABLE public.campaign_steps
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_id   TEXT,
  ADD COLUMN IF NOT EXISTS chiamata_script        TEXT,
  ADD COLUMN IF NOT EXISTS chiamata_obiettivo     TEXT,
  ADD COLUMN IF NOT EXISTS max_tentativi_chiamata INTEGER DEFAULT 3;

-- ─── 6. Extend contacts for call metrics ────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS telefono_chiamabile   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS telefono_dnc          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_chiamata_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totale_chiamate       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS esito_ultima_chiamata TEXT;

-- ─── 7. RLS ─────────────────────────────────────────────────
ALTER TABLE public.call_sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns call_sessions"
  ON public.call_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns automation_rules"
  ON public.automation_rules FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns automation_executions"
  ON public.automation_executions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "call_sessions_service"
  ON public.call_sessions FOR ALL TO service_role USING (true);

CREATE POLICY "automation_rules_service"
  ON public.automation_rules FOR ALL TO service_role USING (true);

CREATE POLICY "automation_executions_service"
  ON public.automation_executions FOR ALL TO service_role USING (true);

-- ─── 8. Realtime ────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_executions;

-- ─── 9. View: call analytics ────────────────────────────────
CREATE OR REPLACE VIEW public.call_analytics AS
SELECT
  c.id AS campaign_id,
  c.nome,
  COUNT(cs.id) AS totale_chiamate,
  COUNT(cs.id) FILTER (WHERE cs.stato = 'completed') AS completate,
  COUNT(cs.id) FILTER (WHERE cs.stato = 'no_answer') AS no_risposta,
  COUNT(cs.id) FILTER (WHERE cs.esito = 'interessato') AS interessati,
  COUNT(cs.id) FILTER (WHERE cs.esito = 'appuntamento') AS appuntamenti,
  COUNT(cs.id) FILTER (WHERE cs.esito = 'richiama') AS da_richiamare,
  ROUND(AVG(cs.durata_secondi) FILTER (WHERE cs.stato = 'completed'), 0) AS durata_media_sec,
  ROUND(SUM(cs.costo_eur), 4) AS costo_totale_eur,
  ROUND(
    COUNT(cs.id) FILTER (WHERE cs.esito = 'interessato')::NUMERIC /
    NULLIF(COUNT(cs.id) FILTER (WHERE cs.stato = 'completed'), 0) * 100, 2
  ) AS tasso_interesse
FROM public.campaigns c
LEFT JOIN public.call_sessions cs ON cs.campaign_id = c.id
GROUP BY c.id, c.nome;

GRANT SELECT ON public.call_analytics TO authenticated;

COMMENT ON TABLE public.call_sessions IS 'Ogni riga = una chiamata AI ElevenLabs a un lead.';
COMMENT ON TABLE public.automation_rules IS 'Regole SE...ALLORA per automatizzare follow-up.';
