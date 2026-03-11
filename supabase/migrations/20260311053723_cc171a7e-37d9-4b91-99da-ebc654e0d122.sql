
-- Add sequence columns to campaigns
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS tipo_campagna text NOT NULL DEFAULT 'blast',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Rome',
  ADD COLUMN IF NOT EXISTS ora_inizio_invio time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS ora_fine_invio time NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS solo_lavorativi boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stop_su_risposta boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tracking_aperture boolean NOT NULL DEFAULT true;

-- Create campaign_steps table
CREATE TABLE public.campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  step_number integer NOT NULL DEFAULT 1,
  tipo text NOT NULL DEFAULT 'email',
  delay_giorni integer NOT NULL DEFAULT 0,
  delay_ore integer NOT NULL DEFAULT 0,
  condizione text NOT NULL DEFAULT 'if_no_reply',
  soggetto text,
  corpo_html text,
  messaggio text,
  ab_padre_id uuid REFERENCES public.campaign_steps(id) ON DELETE CASCADE,
  ab_nome text,
  ab_peso integer NOT NULL DEFAULT 100,
  stat_inviati integer NOT NULL DEFAULT 0,
  stat_aperti integer NOT NULL DEFAULT 0,
  stat_cliccati integer NOT NULL DEFAULT 0,
  stat_risposte integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns campaign_steps" ON public.campaign_steps
  FOR ALL TO authenticated
  USING (user_owns_campaign(campaign_id))
  WITH CHECK (user_owns_campaign(campaign_id));

-- Create campaign_step_executions table
CREATE TABLE public.campaign_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.campaign_steps(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.sender_pool(id),
  stato text NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns campaign_step_executions" ON public.campaign_step_executions
  FOR ALL TO authenticated
  USING (user_owns_campaign(campaign_id))
  WITH CHECK (user_owns_campaign(campaign_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_step_executions;
