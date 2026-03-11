

# Sequenze Multi-Step (Drip Campaigns)

## Current State

The prompt claims "backend is ready" but **none of the required backend exists**:
- No `campaign_steps` table
- No `campaign_step_executions` table  
- No `process-sequence` edge function
- No sequence columns on `campaigns` table (`tipo_campagna`, `timezone`, `ora_inizio_invio`, etc.)

## Plan

### 1. Database Migration

Add columns to `campaigns`:
- `tipo_campagna TEXT DEFAULT 'blast'` (blast | sequence)
- `timezone TEXT DEFAULT 'Europe/Rome'`
- `ora_inizio_invio TIME DEFAULT '08:00'`
- `ora_fine_invio TIME DEFAULT '19:00'`
- `solo_lavorativi BOOLEAN DEFAULT true`
- `stop_su_risposta BOOLEAN DEFAULT true`
- `tracking_aperture BOOLEAN DEFAULT true`

Create `campaign_steps` table:
- `id`, `campaign_id`, `step_number`, `tipo` (email/whatsapp/sms), `delay_giorni`, `delay_ore`, `condizione` (always/if_no_reply/if_no_open/if_opened), `soggetto`, `corpo_html`, `messaggio`, `ab_padre_id`, `ab_nome`, `ab_peso`, `stat_inviati`, `stat_aperti`, `stat_cliccati`, `stat_risposte`, `created_at`
- RLS: user owns campaign via `user_owns_campaign(campaign_id)`

Create `campaign_step_executions` table:
- `id`, `campaign_id`, `step_id`, `recipient_id`, `sender_id`, `stato` (scheduled/sent/skipped/failed), `scheduled_at`, `sent_at`, `opened_at`, `clicked_at`, `replied_at`, `error`, `created_at`
- RLS: user owns campaign via `user_owns_campaign(campaign_id)`

Enable realtime on both tables.

### 2. Edge Function: `process-sequence`

Processes scheduled executions:
1. Fetch all `scheduled` executions where `scheduled_at <= now()`
2. For each, check the step's `condizione` against the recipient's prior step activity
3. Mark as `sent` or `skipped` accordingly
4. For sent ones, schedule the next step execution (current time + delay)
5. Respect `stop_su_risposta`, `solo_lavorativi`, `ora_inizio/fine_invio`, `timezone`

### 3. Types (`src/types/index.ts`)

Add `CampaignStep`, `CampaignStepExecution`, `SequenceStep` interfaces.

### 4. New Components

| File | Purpose |
|------|---------|
| `src/components/campaigns/SequenceBuilder.tsx` | Main builder with vertical step list + add button |
| `src/components/campaigns/StepCard.tsx` | Expandable card per step with channel selector, subject/body editor, A/B toggle |
| `src/components/campaigns/DelayConnector.tsx` | Delay days + condition selector between steps |
| `src/components/campaigns/SequenceProgress.tsx` | Per-step progress bars with open/reply rates |
| `src/components/campaigns/SmartSchedulingTab.tsx` | Send window, timezone, business days, stop-on-reply toggles |

### 5. CampaignWizard Changes

- Add `tipoCampagna` (blast/sequence) selector in Step 0
- Add `WizardData` fields: `tipoCampagna`, scheduling fields, `steps: SequenceStep[]`
- When `tipoCampagna === 'sequence'`, replace Step 2 (Contenuto) with `SequenceBuilder`
- Add Step for SmartSchedulingTab (before review)
- On create: if sequence, save `campaign_steps` rows after campaign insert

### 6. CampaignDetail Changes

- If `tipo_campagna === 'sequence'`, show `SequenceProgress` instead of simple progress bar
- On launch: call `initializeSequence` to create step 1 executions for all recipients
- Show per-step stats in KPI area

### 7. Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create tables + alter campaigns |
| `supabase/functions/process-sequence/index.ts` | Create edge function |
| `src/types/index.ts` | Add interfaces |
| `src/components/campaigns/SequenceBuilder.tsx` | Create |
| `src/components/campaigns/StepCard.tsx` | Create |
| `src/components/campaigns/DelayConnector.tsx` | Create |
| `src/components/campaigns/SequenceProgress.tsx` | Create |
| `src/components/campaigns/SmartSchedulingTab.tsx` | Create |
| `src/components/campaigns/CampaignWizard.tsx` | Add sequence mode |
| `src/pages/CampaignDetail.tsx` | Add sequence progress + init logic |

