
-- 1. Realtime for campaign_recipients and contact_activities (Bug C3)
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_activities;

-- 2. WhatsApp advanced columns (Bug C4)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS template_whatsapp_language TEXT DEFAULT 'it',
  ADD COLUMN IF NOT EXISTS template_whatsapp_variables JSONB DEFAULT '[]';

-- 3. Campaign control columns (Bug C5)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMP WITH TIME ZONE;

-- 4. Index on campaign_recipients for fast queries
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_stato
  ON public.campaign_recipients(campaign_id, stato);

-- 5. Tracking timestamps on campaign_recipients
ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;
