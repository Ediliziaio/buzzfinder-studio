
CREATE TABLE public.pipeline_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  inbox_message_id uuid REFERENCES public.inbox_messages(id) ON DELETE SET NULL,
  pipeline_stage text NOT NULL DEFAULT 'interessato',
  pipeline_note text,
  valore_stimato numeric NOT NULL DEFAULT 0,
  pipeline_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns pipeline_leads"
  ON public.pipeline_leads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_leads;
