
-- Suppression/Unsubscribe list
CREATE TABLE public.suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  motivo TEXT DEFAULT 'unsubscribe',
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.suppression_list
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Follow-up sequences
CREATE TABLE public.follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  attiva BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.follow_up_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.follow_up_sequences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Follow-up steps
CREATE TABLE public.follow_up_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES public.follow_up_sequences(id) ON DELETE CASCADE NOT NULL,
  ordine INTEGER NOT NULL DEFAULT 1,
  delay_giorni INTEGER NOT NULL DEFAULT 3,
  condizione TEXT NOT NULL DEFAULT 'non_aperto',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.follow_up_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.follow_up_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Follow-up execution log
CREATE TABLE public.follow_up_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES public.follow_up_steps(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES public.campaign_recipients(id) ON DELETE CASCADE NOT NULL,
  stato TEXT DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.follow_up_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.follow_up_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for suppression_list
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppression_list;
