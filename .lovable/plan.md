

# Deliverability Suite — Email Validation + Blacklist Monitor + Spintax Helper

## Current State

- **No `blacklist_checks` table** exists in the database
- **No `email_quality` column** on contacts table (only `email_valid` boolean and `email_confidence` integer exist)
- **No `validate-emails` edge function** exists
- EmailEditor has a variable chips bar but no spintax helper
- Settings page has tabs for API Keys, Limits, Senders — no Deliverability tab
- Contacts page toolbar has Import CSV, Export, Add buttons — no Verify Email button

## Plan

### 1. Database Migration

**Add columns to `contacts`:**
- `email_quality text` (values: `valid`, `risky`, `invalid`, `null` = not verified)

**Create `blacklist_checks` table:**
- `id uuid PK`, `user_id uuid`, `sender_id uuid`, `dominio text`, `in_blacklist boolean DEFAULT false`
- `blacklists text[] DEFAULT '{}'`, `checked_at timestamptz DEFAULT now()`
- RLS: `user_id = auth.uid()`

### 2. Edge Function: `validate-emails`

Batch validates contacts' emails using basic syntax/DNS checks (no external API needed initially). Updates `email_quality` and `email_valid` on the contacts table. Accepts `batch_size`, `offset`, optional `list_id`. Returns `{ processed, valid, risky, invalid, done, next_offset }`.

### 3. New Components

| File | Purpose |
|------|---------|
| `src/components/contacts/EmailValidationPanel.tsx` | Dialog with progress bar, run validation, remove invalid |
| `src/components/senders/BlacklistMonitor.tsx` | Check sender domains against DNS blacklists |
| `src/components/campaigns/SpintaxHelper.tsx` | Collapsible panel with template snippets + custom builder |

### 4. Integration Points

- **Contacts page** (`src/pages/Contacts.tsx`): Add "Verifica Email" button in toolbar, open EmailValidationPanel dialog
- **ContactsTable** (`src/components/contacts/ContactsTable.tsx`): Add email_quality badge column after email column
- **EmailEditor** (`src/components/campaigns/EmailEditor.tsx`): Add SpintaxHelper below variable chips bar
- **Settings page** (`src/pages/Settings.tsx`): Add "Deliverability" tab with email validator API key fields + threshold info
- **Contact type** (`src/types/index.ts`): Add `email_quality` field

### 5. Files Summary

| File | Action |
|------|--------|
| Migration SQL | Add `email_quality` to contacts, create `blacklist_checks` |
| `supabase/functions/validate-emails/index.ts` | Create |
| `src/components/contacts/EmailValidationPanel.tsx` | Create |
| `src/components/senders/BlacklistMonitor.tsx` | Create |
| `src/components/campaigns/SpintaxHelper.tsx` | Create |
| `src/pages/Contacts.tsx` | Add verify button |
| `src/components/contacts/ContactsTable.tsx` | Add quality badge column |
| `src/components/campaigns/EmailEditor.tsx` | Add SpintaxHelper |
| `src/pages/Settings.tsx` | Add Deliverability tab |
| `src/types/index.ts` | Add `email_quality` field |

