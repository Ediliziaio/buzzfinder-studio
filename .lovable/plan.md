

# QA Report — Remaining Bugs

## Already Fixed (confirmed)
- No `LeadHunter`, `n8n_settings`, `contatto_id`, `SERVICE_ROLE_KEY` in frontend
- CampaignDetail pause/resume logic: partially fixed but 3 satellite files still wrong
- All edge functions, config.toml, branding: correct

## Bugs Found

### BUG 1 — HIGH (🟠): 3 files still check `"pausa"` instead of `"in_pausa"` against DB data

The DB stores `"in_pausa"` but these files compare against the old `"pausa"` value:

**File 1: `src/pages/Index.tsx` line 22**
```typescript
// BUG: filters for "pausa" which never matches DB value "in_pausa"
const activeCampaigns = campaigns.filter(c => c.stato === "in_corso" || c.stato === "pausa").length;
```
Fix: `c.stato === "pausa"` → `c.stato === "in_pausa"`

**File 2: `src/hooks/useActiveCampaigns.ts` line 13**
```typescript
// BUG: query filters for "pausa" — never matches DB
.in("stato", ["in_corso", "pausa"])
```
Fix: `"pausa"` → `"in_pausa"`

**File 3: `src/components/campaigns/ActiveCampaignCard.tsx` line 37**
```typescript
// BUG: display check uses "pausa" — never matches
{campaign.stato === "pausa" ? (
```
Fix: `"pausa"` → `"in_pausa"`

### BUG 2 — LOW (🟡): CampaignStato type includes both `'pausa'` and `'in_pausa'`

**File: `src/types/index.ts` line 8**
```typescript
export type CampaignStato = '...' | 'pausa' | 'in_pausa' | '...';
```
Fix: Remove `'pausa'` since DB only uses `'in_pausa'`.

## Implementation

| Step | File | Change |
|------|------|--------|
| 1 | `src/types/index.ts` | Remove `'pausa'` from CampaignStato union |
| 2 | `src/pages/Index.tsx` | `"pausa"` → `"in_pausa"` on line 22 |
| 3 | `src/hooks/useActiveCampaigns.ts` | `"pausa"` → `"in_pausa"` on line 13 |
| 4 | `src/components/campaigns/ActiveCampaignCard.tsx` | `"pausa"` → `"in_pausa"` on line 37 |

No other bugs found. All routes, sidebar, edge functions, DB queries, schema naming, and error handling verified correct.

