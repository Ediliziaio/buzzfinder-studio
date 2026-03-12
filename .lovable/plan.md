

# Bug Fix — CampaignWizard toast import

## Analysis Results

After reading all the files mentioned in the bug report, **nearly every reported bug is already fixed**:

| Bug | Status |
|-----|--------|
| AI-01 handle-reply schema | ✅ Already uses `chiave`/`valore` via `callAI` helper |
| AI-02 handle-reply FK | ✅ No `contatto_id` in current code |
| AI-03 validate-emails schema | ✅ Already uses `chiave`/`valore` (lines 123-127) |
| AI-04 process-sequence n8n_settings | ✅ Uses `getAppSetting` helper with `app_settings` |
| AI-05 process-sequence `sito` | ✅ Uses `sito_web` (line 197) |
| AI-06 process-sequence `contatto_id` | ✅ Uses `contact_id` (line 197) |
| AI-07 CampaignDetail launch flow | ✅ Calls `assign-senders`, `initializeSequence`, creates executions |
| AI-08 CampaignWizard AI fields | ✅ Saves all AI fields (lines 292-303) |
| AI-09 CampaignWizard toast | **❌ REAL BUG** — uses `@/hooks/use-toast` |
| AI-10 Settings API keys | Already has AI agent tab with keys |
| AI-11 Sender tab | Separate concern, not blocking |
| Pausa → in_pausa | ✅ Already saves `in_pausa` to DB (line 280) |
| Cancel future executions on pause | ✅ Already implemented (lines 285-289) |

## Only Fix Needed

**File**: `src/components/campaigns/CampaignWizard.tsx` line 21
- Change `import { toast } from "@/hooks/use-toast"` → `import { toast } from "sonner"`
- Update 3 toast calls from `toast({ title, description })` to `toast.success()` / `toast.error()` format

