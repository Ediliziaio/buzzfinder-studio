

## Scraping Module — Gap Analysis & Implementation Plan

After reviewing the full codebase, the scraping module architecture is already correct: frontend creates session → triggers n8n webhook → Supabase Realtime updates UI. However, several refinements from the prompt are missing.

### Gaps Found

1. **No n8n health check before starting scraping jobs** — The Maps and Websites pages call `triggerN8nWebhook` directly without first verifying n8n is reachable. The health check exists only in Settings (test button). If n8n is down, the user gets a generic axios error instead of the clear "n8n non raggiungibile" panel.

2. **No email blacklist filtering in extraction logic** — The prompt specifies rigorous email blacklist patterns (`noreply@`, `test@`, file extensions like `.png@`, sentry domains, etc.). The current `emailValidator.ts` has basic role/disposable checks but not the full scraping-specific blacklist.

3. **No Zod validation schema for imported contacts** — The prompt requires `contactImportSchema` with strict validation before any INSERT. Currently CSV import and scraping results are inserted without Zod validation.

4. **No "live feed" of last imported contacts** in the Maps progress panel — The prompt shows "Ultimi importati:" list during scraping. Currently only the progress box (`MapsProgressBox`) shows counters.

5. **Scraping Maps: no `radius_meters` in webhook payload** — The payload sends `raggio_km` but the Google Places API spec in the prompt uses `radius_meters`. Minor naming issue for n8n workflow consistency.

6. **No confirmation dialog on STOP scraping** — The prompt requires confirmation dialogs for destructive actions. Stopping a scraping session has no confirmation.

7. **Website scraper: no "Retry" functionality** for failed jobs — The retry button exists visually but isn't wired to any handler.

### Implementation Plan

**Phase 1: n8n Health Check Service**
- Add `checkN8nHealth()` to `src/services/n8n.ts` that fetches `{n8n_url}/healthz` with 3s timeout
- Call it in `ScraperMaps.handleStart()` and `ScraperWebsites.handleStart()` before creating the session
- On failure, show a clear error panel (not just a toast) with the configured URL and links to Settings
- Update `AppHeader` to periodically check n8n health and update `n8nStatus` in the store

**Phase 2: Contact Import Validation Schema**
- Create `src/lib/validators/contact.ts` with Zod schema matching the prompt's `contactImportSchema`
- Strict phone regex (`/^\+39\d{9,12}$/`), email validation, URL normalization transform
- Apply in CSV import flow (`CsvImportDialog`) before batch insert
- Add scraping-specific email blacklist patterns to `emailValidator.ts` (file extensions, sentry, test@, etc.)

**Phase 3: Live Feed in Maps Progress**
- Add a "last 5 imported" contacts feed to `MapsProgressBox` using the existing Realtime INSERT subscription on contacts
- Show azienda, citta, and status icons (con sito/con tel/solo indirizzo)

**Phase 4: Website Scraper Retry**
- Wire the retry button in `WebScraperQueue` `JobItem` to update the job status back to `queued` and re-trigger the n8n webhook for that single job
- Add confirmation dialog on STOP for both Maps and Websites scraper pages

**Phase 5: n8n Status in Header**
- Move n8n health check to `AppHeader` useEffect, poll every 30s
- Update store `n8nStatus` based on result so it reflects real connectivity

All changes are frontend-only. The n8n workflows and ScrapingBee integration remain server-side as designed.

