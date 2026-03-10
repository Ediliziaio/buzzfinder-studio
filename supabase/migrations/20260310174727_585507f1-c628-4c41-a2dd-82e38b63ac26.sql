
-- Add user_id to main tables
ALTER TABLE public.contacts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.lists ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.scraping_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.suppression_list ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.usage_log ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.follow_up_sequences ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated full access" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated full access" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated full access" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Authenticated full access" ON public.lists;
DROP POLICY IF EXISTS "Authenticated full access" ON public.list_contacts;
DROP POLICY IF EXISTS "Authenticated full access" ON public.scraping_sessions;
DROP POLICY IF EXISTS "Authenticated full access" ON public.scraping_jobs;
DROP POLICY IF EXISTS "Authenticated full access" ON public.contact_activities;
DROP POLICY IF EXISTS "Authenticated full access" ON public.suppression_list;
DROP POLICY IF EXISTS "Authenticated full access" ON public.usage_log;
DROP POLICY IF EXISTS "Authenticated full access" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated full access" ON public.follow_up_sequences;
DROP POLICY IF EXISTS "Authenticated full access" ON public.follow_up_steps;
DROP POLICY IF EXISTS "Authenticated full access" ON public.follow_up_log;

-- New RLS policies: user_id based for main tables
CREATE POLICY "User owns contacts" ON public.contacts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns lists" ON public.lists FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns scraping_sessions" ON public.scraping_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns suppression_list" ON public.suppression_list FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns usage_log" ON public.usage_log FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "User owns follow_up_sequences" ON public.follow_up_sequences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Child tables: RLS via parent FK join using security definer functions

-- campaign_recipients: access if user owns the campaign
CREATE OR REPLACE FUNCTION public.user_owns_campaign(_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.campaigns WHERE id = _campaign_id AND user_id = auth.uid())
$$;

CREATE POLICY "User owns campaign_recipients" ON public.campaign_recipients FOR ALL TO authenticated
  USING (public.user_owns_campaign(campaign_id)) WITH CHECK (public.user_owns_campaign(campaign_id));

-- contact_activities: access if user owns the contact
CREATE OR REPLACE FUNCTION public.user_owns_contact(_contact_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contacts WHERE id = _contact_id AND user_id = auth.uid())
$$;

CREATE POLICY "User owns contact_activities" ON public.contact_activities FOR ALL TO authenticated
  USING (public.user_owns_contact(contact_id)) WITH CHECK (public.user_owns_contact(contact_id));

-- scraping_jobs: access if user owns the session
CREATE OR REPLACE FUNCTION public.user_owns_scraping_session(_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.scraping_sessions WHERE id = _session_id AND user_id = auth.uid())
$$;

CREATE POLICY "User owns scraping_jobs" ON public.scraping_jobs FOR ALL TO authenticated
  USING (public.user_owns_scraping_session(session_id)) WITH CHECK (public.user_owns_scraping_session(session_id));

-- list_contacts: access if user owns the list
CREATE OR REPLACE FUNCTION public.user_owns_list(_list_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.lists WHERE id = _list_id AND user_id = auth.uid())
$$;

CREATE POLICY "User owns list_contacts" ON public.list_contacts FOR ALL TO authenticated
  USING (public.user_owns_list(list_id)) WITH CHECK (public.user_owns_list(list_id));

-- follow_up_steps: access if user owns the sequence
CREATE OR REPLACE FUNCTION public.user_owns_sequence(_sequence_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follow_up_sequences WHERE id = _sequence_id AND user_id = auth.uid())
$$;

CREATE POLICY "User owns follow_up_steps" ON public.follow_up_steps FOR ALL TO authenticated
  USING (public.user_owns_sequence(sequence_id)) WITH CHECK (public.user_owns_sequence(sequence_id));

-- follow_up_log: access if user owns the step's sequence
CREATE OR REPLACE FUNCTION public.user_owns_step(_step_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follow_up_steps fs
    JOIN public.follow_up_sequences fq ON fq.id = fs.sequence_id
    WHERE fs.id = _step_id AND fq.user_id = auth.uid()
  )
$$;

CREATE POLICY "User owns follow_up_log" ON public.follow_up_log FOR ALL TO authenticated
  USING (public.user_owns_step(step_id)) WITH CHECK (public.user_owns_step(step_id));
