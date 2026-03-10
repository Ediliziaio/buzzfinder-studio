

# Scraper Google Maps: Hybrid Edge Function Architecture

The campaign bug fixes described in this prompt are already fully implemented. The only new work is **replacing the n8n-based Google Maps scraping with a browser-loop calling the `scrape-maps-page` Edge Function**.

## What changes

### 1. Create Edge Function `scrape-maps-page`

New file `supabase/functions/scrape-maps-page/index.ts` that:
- Receives `session_id`, `query`, `citta`, `raggio_km`, `max_results`, `next_page_token`, `filtri`
- Calls Google Places API (Text Search) with the query + city
- Filters results by rating, reviews, website/phone presence
- Inserts matching contacts into the `contacts` table
- Updates `scraping_sessions` progress counters
- Returns `{ done, next_page_token, total_importati }` or `{ aborted: true }` if session status changed

Requires `GOOGLE_MAPS_API_KEY` secret -- will read from `app_settings` table using service role key.

Add to `supabase/config.toml`:
```toml
[functions.scrape-maps-page]
verify_jwt = false
```

### 2. Rewrite `src/pages/ScraperMaps.tsx`

Key architectural changes:
- `MapsConfig.citta` changes from `string[]` to `string` (single city per session)
- Remove n8n dependency (`triggerN8nWebhook`, `checkN8nHealth`, `getN8nSettings`)
- Add `useRef` controls: `isPaused`, `isStopped` for instant pause/stop
- Add `runScrapingLoop()` that calls `supabase.functions.invoke("scrape-maps-page")` in a `while(true)` loop, checking refs each iteration
- `handlePause` sets `isPaused.current = true` (instant effect)
- `handleResume` sets `isPaused.current = false`
- `handleStop` sets `isStopped.current = true` (loop breaks immediately)
- Remove `user_id` from session insert (RLS handles it)
- Track `isRunningLocal` state separately from DB session status

### 3. Update `src/components/scraper/MapsConfigPanel.tsx`

- Change `citta` from array to single string input (remove multi-city chips UI)
- Add `isPaused?: boolean` and `onResume?: () => void` to Props
- Update action buttons: show RIPRENDI when paused, PAUSA when running
- Disable AVVIA when `isPaused` is true
- Update cost estimate display (no "x N citta" multiplier)
- Simplify city suggestions to set value directly instead of array push

### 4. DB Migration

Add columns for scraping session pause tracking:
```sql
ALTER TABLE public.scraping_sessions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP WITH TIME ZONE;
```

## Files affected

| File | Action |
|------|--------|
| `supabase/functions/scrape-maps-page/index.ts` | Create |
| `supabase/config.toml` | Add function config (auto-managed) |
| `src/pages/ScraperMaps.tsx` | Rewrite |
| `src/components/scraper/MapsConfigPanel.tsx` | Modify (single city + pause/resume) |
| Migration SQL | Add paused_at/resumed_at columns |

## Not touched

- `MapsProgressBox`, `MapsResultsTable`, `MapsPreviousSessions` -- unchanged
- `useScrapingSession` hook -- unchanged
- All campaign files -- already fixed
- Auth/theme -- unchanged

