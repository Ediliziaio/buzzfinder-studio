ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email_quality text;

CREATE TABLE public.blacklist_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender_id uuid REFERENCES public.sender_pool(id) ON DELETE CASCADE,
  dominio text NOT NULL,
  in_blacklist boolean NOT NULL DEFAULT false,
  blacklists text[] NOT NULL DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blacklist_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User owns blacklist_checks"
  ON public.blacklist_checks
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());