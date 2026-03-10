

# Fix: Scraper Google Maps RLS Error

## Problem

The scraper fails with a **403 RLS error** when clicking "AVVIA SCRAPING":

```
"new row violates row-level security policy for table \"scraping_sessions\""
```

The `handleStart` function in `ScraperMaps.tsx` inserts into `scraping_sessions` without including `user_id`. The RLS policy requires `user_id = auth.uid()`.

## Fix

**File: `src/pages/ScraperMaps.tsx`**

1. Import `getCurrentUserId` from `@/lib/auth`
2. In `handleStart()`, call `const user_id = await getCurrentUserId()` before the insert
3. Add `user_id` to the insert object

This follows the exact same pattern already used in `ScraperWebsites.tsx`, `CampaignWizard.tsx`, `Campaigns.tsx`, etc.

Single-line change in the insert at line 140:
```typescript
.insert({ user_id, tipo: "google_maps", query: config.query, ... })
```

