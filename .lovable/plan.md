

# QA Analysis Report & Fix Plan — BuzzFinder Studio

## Bugs Found

### BUG 1 — CRITICAL (🔴): Resume button never appears (CampaignDetail.tsx)

**File:** `src/pages/CampaignDetail.tsx`

- Line 280: Pause sets `stato: "in_pausa"`
- Line 304: Resume condition checks `campaign.stato === "pausa"` — **never matches**
- Line 433: Resume button shows only when `campaign.stato === "pausa"` — **never visible**

**Fix:** Change all 3 occurrences of `"pausa"` (the standalone check) to `"in_pausa"`:
- Line 205: `campaign.stato !== "pausa"` → `campaign.stato !== "in_pausa"`
- Line 304: `campaign.stato === "pausa"` → `campaign.stato === "in_pausa"`
- Line 385: `["in_corso", "completata", "pausa"]` → `["in_corso", "completata", "in_pausa"]`
- Line 433: `campaign.stato === "pausa"` → `campaign.stato === "in_pausa"`

### BUG 2 — HIGH (🟠): track-open parameter mismatch

**File:** `supabase/functions/process-sequence/index.ts` line 248:
```
const pixelUrl = `${baseUrl}/functions/v1/track-open?id=${exec.id}`;
```
But `track-open/index.ts` reads `rid` and `cid`, not `id`.

**Fix:** Change process-sequence line 248 to:
```
const pixelUrl = `${baseUrl}/functions/v1/track-open?rid=${exec.recipient_id}&cid=${exec.campaign_id}`;
```

### BUG 3 — HIGH (🟠): track-open and unsubscribe missing from config.toml

Both are public endpoints (called by email clients / browsers) but `verify_jwt` is not set to `false` in config.toml. They will fail with 401.

**Fix:** Add to `supabase/config.toml`:
```toml
[functions.track-open]
verify_jwt = false

[functions.unsubscribe]
verify_jwt = false

[functions.assign-senders]
verify_jwt = false
```

### BUG 4 — MEDIUM (🟡): Brand name "LeadHunter" still showing in 5 places

- `src/pages/Auth.tsx` line 43: "LeadHunter" → "BuzzFinder"
- `src/pages/Auth.tsx` line 45: "B2B LEAD GENERATION PLATFORM" → "LEAD GENERATION STUDIO"
- `src/pages/Auth.tsx` line 57: placeholder "admin@leadhunter.it" → "admin@buzzfinder.it"
- `src/components/layout/AppSidebar.tsx` line 193: "LeadHunter" → "BuzzFinder"
- `src/components/layout/AppHeader.tsx` line 101: "LeadHunter" → "BuzzFinder"
- `src/pages/Settings.tsx` line 53: backup filename "leadhunter_backup" → "buzzfinder_backup"

### BUG 5 — MEDIUM (🟡): validate-emails reads wrong setting keys

**File:** `supabase/functions/validate-emails/index.ts` line 124:
Reads `email_validator_provider` and `email_validator_key` but Settings page saves as `millionverifier_api_key` and `zerobounce_api_key`.

**Fix:** Update validate-emails to read the correct keys:
```typescript
.in("chiave", ["millionverifier_api_key", "zerobounce_api_key"])
```
Then determine provider based on which key exists.

### BUG 6 — LOW (🟡): unsubscribe function missing user_id

The `suppression_list` table has RLS requiring `user_id = auth.uid()`, but the unsubscribe edge function uses SERVICE_ROLE_KEY (bypasses RLS). However the insert doesn't include `user_id`, which means `user_id` will be null and future client queries won't see these entries.

**Fix:** Look up the contact's `user_id` before inserting into suppression_list.

---

## What's Already Correct (No Fix Needed)

| Area | Status |
|------|--------|
| Routes in App.tsx | All 14 routes present, all inside RequireAuth |
| Types (src/types/index.ts) | Complete — `contact_id`, `sito_web`, all interfaces present |
| Sidebar groups + badges | Correct — uses `useInboxUnreadCount` + `useSenderPool` |
| Schema naming (`chiave`/`valore`, `contact_id`, `sito_web`) | Correct everywhere |
| No `n8n_settings` table references | Confirmed — zero matches |
| No `contatto_id` references | Confirmed — zero matches |
| Settings page | Complete — all required fields present |
| handle-reply edge function | Correct — uses Lovable AI, correct field names |
| assign-senders edge function | Correct — proper warmup logic, `contact_id` |
| process-sequence edge function | Correct schema usage, spintax, scheduling windows |
| Auth page | Proper signIn/signUp with toast errors, loading state |
| Contacts page | Correct `sito_web`, pagination, filters, drawer |
| Realtime subscriptions | Properly cleaned up in hooks |
| Edge functions CORS headers | Present in all functions |

---

## Implementation Order

| Step | File | Fix |
|------|------|-----|
| 1 | `src/pages/CampaignDetail.tsx` | Fix `"pausa"` → `"in_pausa"` in 4 locations |
| 2 | `supabase/functions/process-sequence/index.ts` | Fix tracking pixel URL params |
| 3 | `supabase/config.toml` | Add `verify_jwt = false` for track-open, unsubscribe, assign-senders |
| 4 | `src/pages/Auth.tsx` | Rebrand to BuzzFinder |
| 5 | `src/components/layout/AppSidebar.tsx` | Rebrand to BuzzFinder |
| 6 | `src/components/layout/AppHeader.tsx` | Rebrand to BuzzFinder |
| 7 | `src/pages/Settings.tsx` | Rebrand backup filename |
| 8 | `supabase/functions/validate-emails/index.ts` | Fix setting key names |
| 9 | `supabase/functions/unsubscribe/index.ts` | Add user_id lookup on insert |

