
-- A/B testing fields on campaigns
ALTER TABLE public.campaigns ADD COLUMN ab_test_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN subject_b TEXT;
ALTER TABLE public.campaigns ADD COLUMN ab_test_split INTEGER DEFAULT 50;
ALTER TABLE public.campaigns ADD COLUMN ab_test_sample_size INTEGER DEFAULT 100;
ALTER TABLE public.campaigns ADD COLUMN ab_winner TEXT;
ALTER TABLE public.campaigns ADD COLUMN ab_winner_selected_at TIMESTAMPTZ;
ALTER TABLE public.campaigns ADD COLUMN aperti_a INTEGER DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN aperti_b INTEGER DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN inviati_a INTEGER DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN inviati_b INTEGER DEFAULT 0;
