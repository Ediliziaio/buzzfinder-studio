
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  template_whatsapp_id TEXT,
  template_whatsapp_language TEXT DEFAULT 'it',
  template_whatsapp_variables JSONB DEFAULT '[]',
  sender_email TEXT,
  sender_name TEXT,
  reply_to TEXT,
  sending_rate_per_hour INTEGER DEFAULT 500,
  ai_personalization_enabled BOOLEAN DEFAULT false,
  ai_model TEXT,
  ai_context TEXT,
  ai_objective TEXT,
  utilizzi INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns campaign_templates"
  ON public.campaign_templates
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled
  ON public.campaigns(scheduled_at)
  WHERE stato = 'schedulata' AND scheduled_at IS NOT NULL;
