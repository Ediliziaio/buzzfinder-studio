
CREATE TABLE public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  execution_id uuid,
  canale text NOT NULL DEFAULT 'email',
  da_nome text,
  da_email text,
  da_telefono text,
  oggetto text,
  corpo text NOT NULL DEFAULT '',
  corpo_html text,
  data_ricezione timestamptz NOT NULL DEFAULT now(),
  letto boolean NOT NULL DEFAULT false,
  archiviato boolean NOT NULL DEFAULT false,
  assegnato_a uuid,
  etichetta text NOT NULL DEFAULT 'non_categorizzato',
  etichetta_ai boolean NOT NULL DEFAULT false,
  note text,
  thread_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns inbox_messages"
  ON public.inbox_messages
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_messages;

CREATE INDEX idx_inbox_messages_user_letto ON public.inbox_messages(user_id, letto) WHERE archiviato = false;
CREATE INDEX idx_inbox_messages_user_etichetta ON public.inbox_messages(user_id, etichetta);
