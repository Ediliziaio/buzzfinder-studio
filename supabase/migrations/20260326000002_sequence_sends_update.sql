-- Update sequence_sends table:
-- 1. Make step_id nullable (may not always have it)
-- 2. Add step_number for easier querying
-- 3. Add subject and from_email for audit trail
ALTER TABLE sequence_sends
  ALTER COLUMN step_id DROP NOT NULL;

ALTER TABLE sequence_sends
  ADD COLUMN IF NOT EXISTS step_number INTEGER,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS from_email TEXT;
