
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ai_personalization_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_context TEXT,
  ADD COLUMN IF NOT EXISTS ai_objective TEXT,
  ADD COLUMN IF NOT EXISTS ai_personalization_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_personalization_processed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_personalization_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_eur NUMERIC DEFAULT 0;

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS messaggio_personalizzato TEXT,
  ADD COLUMN IF NOT EXISTS soggetto_personalizzato TEXT;
