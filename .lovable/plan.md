

# QA Report — BuzzFinder Studio

## Already Fixed (from previous QA pass)
All critical and high-priority bugs identified in the prior QA were already applied:
- CampaignDetail `"pausa"` → `"in_pausa"` logic ✅
- Tracking pixel `?rid=&cid=` params ✅
- `config.toml` verify_jwt for all public endpoints ✅
- `validate-emails` correct setting keys ✅
- `unsubscribe` user_id lookup ✅
- Branding in Auth.tsx, AppSidebar, AppHeader, Settings ✅
- No `n8n_settings` references ✅
- No `contatto_id` references ✅
- No `SERVICE_ROLE_KEY` in frontend ✅
- Schema naming (`chiave`/`valore`, `contact_id`, `sito_web`) correct everywhere ✅

## Remaining Bugs Found

### BUG 1 — MEDIUM (🟡): "LeadHunter" still in 2 campaign files

**Files:**
- `src/components/campaigns/CampaignWizard.tsx` lines 521, 809: placeholder `"LeadHunter Pro"` → `"BuzzFinder"`
- `src/components/campaigns/EmailPreviewDialog.tsx` line 62: fallback `"LeadHunter"` → `"BuzzFinder"`

**Fix:** 3 string replacements across 2 files.

## Implementation

| Step | File | Change |
|------|------|--------|
| 1 | `src/components/campaigns/CampaignWizard.tsx` | Replace 2x `"LeadHunter Pro"` → `"BuzzFinder"` in placeholders |
| 2 | `src/components/campaigns/EmailPreviewDialog.tsx` | Replace `"LeadHunter"` → `"BuzzFinder"` in fallback sender name |

No other bugs found. All routes, sidebar links, edge functions, DB queries, types, and error handling are correct.

