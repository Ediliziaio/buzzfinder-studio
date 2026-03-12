

# Bug Fix Plan — BuzzFinder Studio

## Already Fixed (No Action Needed)
BUG-01 through BUG-10, BUG-13, BUG-14, BUG-15, BUG-17, BUG-18, BUG-19, BUG-22, BUG-24, BUG-25 are all already resolved in the current codebase.

## Real Remaining Bugs

### 1. BUG-11 — `CampaignRecipient` missing pipeline/sender fields
**File**: `src/types/index.ts` lines 200-214
**Fix**: Add `pipeline_stage`, `pipeline_note`, `pipeline_updated`, `risposta_at` to the interface (these exist in DB schema).

### 2. BUG-12 — `Contact` missing validation/AI fields
**File**: `src/types/index.ts` lines 18-53
**Fix**: Add `email_validato`, `email_validato_at`, `ai_intro`, `ai_modello`, `ai_personalizzato_at` to the interface.

### 3. BUG-16 — Backup missing tables
**File**: `src/pages/Settings.tsx` line 52
**Fix**: Add `sender_pool`, `campaign_steps`, `campaign_step_executions`, `inbox_messages`, `email_events`, `unsubscribes`, `suppression_list`, `blacklist_checks`, `follow_up_sequences`, `follow_up_steps`, `follow_up_log`, `sender_daily_stats`, `pipeline_leads`, `campaign_templates` to the backup tables list.

### 4. BUG-20 — `Campaigns.tsx` uses wrong toast import
**File**: `src/pages/Campaigns.tsx` line 13
**Fix**: Change `import { toast } from "@/hooks/use-toast"` to `import { toast } from "sonner"` and update any `toast({ title, description })` calls to `toast.success()` / `toast.error()` format.

## Implementation
4 targeted edits across 3 files. No database changes needed.

