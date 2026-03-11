

# Sender Pool & Anti-Spam Rotation

## Prerequisites

The `sender_pool` table does NOT exist yet in the database. It must be created first via migration. The `campaign_recipients` table also needs a `sender_id` column.

## 1. Database Migration

Create `sender_pool` table with all required columns (identity, channel-specific fields, health metrics, warm-up tracking, limits). Add `sender_id` column to `campaign_recipients`. Add realtime publication. RLS policy scoped to `user_id = auth.uid()`.

```sql
CREATE TABLE public.sender_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- email | whatsapp | sms
  attivo BOOLEAN DEFAULT true,
  stato TEXT DEFAULT 'active', -- active | warming | paused | banned
  note TEXT,
  -- Email fields
  email_from TEXT, email_nome TEXT, reply_to TEXT, dominio TEXT,
  resend_api_key TEXT,
  spf_ok BOOLEAN DEFAULT false, dkim_ok BOOLEAN DEFAULT false, dmarc_ok BOOLEAN DEFAULT false,
  -- WhatsApp fields
  wa_phone_number_id TEXT, wa_access_token TEXT, wa_numero TEXT,
  wa_tier TEXT DEFAULT 'tier_1', wa_quality TEXT DEFAULT 'green',
  -- SMS fields
  sms_from TEXT, sms_provider TEXT DEFAULT 'twilio',
  sms_api_key TEXT, sms_api_secret TEXT,
  -- Limits
  max_per_day INTEGER DEFAULT 50, inviati_oggi INTEGER DEFAULT 0,
  ultimo_reset DATE DEFAULT CURRENT_DATE,
  -- Health
  bounce_rate NUMERIC DEFAULT 0, spam_rate NUMERIC DEFAULT 0, health_score INTEGER DEFAULT 100,
  -- Warm-up
  warmup_attivo BOOLEAN DEFAULT true, warmup_giorno INTEGER DEFAULT 0,
  warmup_iniziato DATE,
  -- Stats
  totale_inviati INTEGER DEFAULT 0, totale_bounce INTEGER DEFAULT 0, totale_spam INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sender_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns sender_pool" ON public.sender_pool
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.campaign_recipients ADD COLUMN IF NOT EXISTS sender_id UUID;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sender_pool;
```

## 2. Types (`src/types/index.ts`)

Add `SenderPool` interface with all fields matching the table.

## 3. Hook (`src/hooks/useSenderPool.ts`)

- Fetch senders with optional `tipo` filter, ordered by `health_score` desc
- Realtime subscription on `sender_pool` table
- Helper methods: `toggleActive`, `deleteSender`
- Computed `capacitaOggi` (remaining daily capacity across active senders)

## 4. New Components

| File | Purpose |
|------|---------|
| `src/components/senders/SenderCard.tsx` | Card showing health score bar, daily usage bar, DNS badges (email), WA quality (whatsapp), action buttons |
| `src/components/senders/SenderDialog.tsx` | Add/Edit dialog with type-specific fields (Email: email_from, resend_api_key, SPF/DKIM toggles; WA: wa_numero, phone_number_id, access_token, tier; SMS: sms_from, provider, api_key/secret). Password inputs for secrets with eye toggle. |
| `src/components/senders/SenderHealthDashboard.tsx` | KPI row: Active, Warming, Paused, Alerts count + total remaining capacity |
| `src/components/senders/AssignmentResultDialog.tsx` | Pre-launch dialog showing sender distribution from `assign-senders` edge function response |

## 5. Settings Page Integration

Add a new tab "Pool Mittenti" in `src/pages/Settings.tsx` TabsList. The tab content renders:
1. `SenderHealthDashboard` at top
2. Alert banners for high bounce/spam rate or missing DNS
3. Sub-tabs for Email/WhatsApp/SMS filtering
4. Grid of `SenderCard` components
5. "Aggiungi Mittente" button opening `SenderDialog`

## 6. Campaign Detail Integration

In `src/pages/CampaignDetail.tsx`, modify the launch flow (`handleStatusChange` when `newStato === "in_corso"`):
- Before triggering n8n, call `supabase.functions.invoke('assign-senders', { body: { campaign_id } })`
- If `assigned === 0`, show error and abort
- Otherwise show `AssignmentResultDialog` with distribution summary
- On confirm in dialog, proceed with existing n8n trigger logic

## Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create `sender_pool` table + `sender_id` on recipients |
| `src/types/index.ts` | Add `SenderPool` interface |
| `src/hooks/useSenderPool.ts` | Create |
| `src/components/senders/SenderCard.tsx` | Create |
| `src/components/senders/SenderDialog.tsx` | Create |
| `src/components/senders/SenderHealthDashboard.tsx` | Create |
| `src/components/senders/AssignmentResultDialog.tsx` | Create |
| `src/pages/Settings.tsx` | Add "Pool Mittenti" tab |
| `src/pages/CampaignDetail.tsx` | Add assign-senders pre-launch step |

