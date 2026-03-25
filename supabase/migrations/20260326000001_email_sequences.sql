-- Email sequences
CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descrizione TEXT,
  status TEXT NOT NULL DEFAULT 'bozza' CHECK (status IN ('bozza','attiva','archiviata')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steps of each sequence
CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0, -- days after previous step (0 = same day)
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrolled contacts
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES sender_pool(id),
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'attiva' CHECK (status IN ('attiva','completata','fermata','errore')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  next_send_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  UNIQUE(sequence_id, contact_id)
);

-- Log of sent sequence emails
CREATE TABLE IF NOT EXISTS sequence_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES sequence_steps(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'inviato' CHECK (status IN ('inviato','errore','aperto','risposto')),
  error_message TEXT
);

-- RLS
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sequences" ON email_sequences FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_steps" ON sequence_steps FOR ALL USING (
  sequence_id IN (SELECT id FROM email_sequences WHERE user_id = auth.uid())
);
CREATE POLICY "own_enrollments" ON sequence_enrollments FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_sends" ON sequence_sends FOR ALL USING (
  enrollment_id IN (SELECT id FROM sequence_enrollments WHERE user_id = auth.uid())
);
