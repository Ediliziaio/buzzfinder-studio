-- Fix: drop unique constraint on chiave alone, add composite (chiave, user_id)
-- This allows multiple users to have settings with the same key

-- Drop old unique constraint on chiave alone
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_chiave_key;

-- Remove orphaned rows with NULL user_id where a user_id version already exists
DELETE FROM public.app_settings
WHERE user_id IS NULL
  AND chiave IN (
    SELECT chiave FROM public.app_settings WHERE user_id IS NOT NULL
  );

-- Delete any remaining NULL user_id rows (no owner)
DELETE FROM public.app_settings WHERE user_id IS NULL;

-- Add composite unique constraint
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_chiave_user_id_key UNIQUE (chiave, user_id);
