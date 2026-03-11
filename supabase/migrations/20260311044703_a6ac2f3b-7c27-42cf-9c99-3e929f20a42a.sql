
CREATE TABLE public.sender_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  attivo BOOLEAN DEFAULT true,
  stato TEXT DEFAULT 'active',
  note TEXT,
  email_from TEXT,
  email_nome TEXT,
  reply_to TEXT,
  dominio TEXT,
  resend_api_key TEXT,
  spf_ok BOOLEAN DEFAULT false,
  dkim_ok BOOLEAN DEFAULT false,
  dmarc_ok BOOLEAN DEFAULT false,
  wa_phone_number_id TEXT,
  wa_access_token TEXT,
  wa_numero TEXT,
  wa_tier TEXT DEFAULT 'tier_1',
  wa_quality TEXT DEFAULT 'green',
  sms_from TEXT,
  sms_provider TEXT DEFAULT 'twilio',
  sms_api_key TEXT,
  sms_api_secret TEXT,
  max_per_day INTEGER DEFAULT 50,
  inviati_oggi INTEGER DEFAULT 0,
  ultimo_reset DATE DEFAULT CURRENT_DATE,
  bounce_rate NUMERIC DEFAULT 0,
  spam_rate NUMERIC DEFAULT 0,
  health_score INTEGER DEFAULT 100,
  warmup_attivo BOOLEAN DEFAULT true,
  warmup_giorno INTEGER DEFAULT 0,
  warmup_iniziato DATE,
  totale_inviati INTEGER DEFAULT 0,
  totale_bounce INTEGER DEFAULT 0,
  totale_spam INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sender_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns sender_pool" ON public.sender_pool
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.sender_pool(id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sender_pool;
