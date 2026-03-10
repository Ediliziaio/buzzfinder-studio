

## Scraping Module — Remaining Gap: CSV Import Zod Validation

After thorough review, the scraping module is already fully implemented per the prompt requirements:

- n8n health check before starting jobs (with toast error + redirect to settings)
- Supabase Realtime subscriptions for live progress (no polling)
- Email blacklist patterns in `emailValidator.ts` (`isScrapingBlacklisted`)
- Zod validation schema in `src/lib/validators/contact.ts` (`contactImportSchema` + `validateContactBatch`)
- Phone normalization in `phoneNormalizer.ts`
- Live feed of last imported contacts in `ScraperMaps.tsx`
- Confirmation dialogs on STOP for both Maps and Websites scrapers
- Retry button wired in `WebScraperQueue.tsx`
- All null fields render as "—" in tables (verified in `MapsResultsTable`)
- Zero mock data anywhere in the codebase
- n8n status polling every 30s in `AppHeader.tsx`

### One Remaining Gap: CSV Import Validation

The `CsvImportDialog.tsx` (lines 81-115) inserts contacts **without** running them through the Zod `contactImportSchema`. It builds raw objects and inserts directly. The prompt requires validation before every INSERT, with invalid rows separated and shown to the user.

### Implementation Plan

**Update `CsvImportDialog.tsx`**:
1. Import `validateContactBatch` from `src/lib/validators/contact.ts` and `normalizeItalianPhone` from `phoneNormalizer.ts`
2. Before inserting, normalize phone/email/URL fields on each mapped row
3. Run `validateContactBatch(batch)` to split into `valid` and `invalid` arrays
4. Only insert `valid` rows into Supabase
5. Show count of invalid rows in the success toast (e.g. "1.200 importati, 34 scartati per errori di validazione")
6. If there are invalid rows, show a collapsible section with the first 10 invalid rows and their error messages

This is a single-file change to `CsvImportDialog.tsx`.

