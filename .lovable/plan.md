

# Piano di implementazione — Fix Round 7 Scraper Siti Web

## Panoramica

12 fix suddivisi in 3 blocchi: sicurezza, edge function autonoma, UX/feature parity.

---

## Blocco 1: Sicurezza e filtri `user_id`

**File: `src/pages/ScraperWebsites.tsx`**

1. **Contact matching (riga 192-196)**: aggiungere `const userId = await getCurrentUserId()` (gia disponibile a riga 174) e `.eq("user_id", userId)` alla query contacts.

2. **`handleImportFromMaps` (riga 119-139)**: aggiungere filtro `user_id` esplicito con `getCurrentUserId()`.

3. **`handleImportFromContacts` (riga 141-154)**: stesso fix, aggiungere `.eq("user_id", userId)`.

---

## Blocco 2: Edge Function `scrape-website`

Creare `supabase/functions/scrape-website/index.ts` — scraper autonomo che funziona senza n8n.

**Approccio**: fetch diretto dell'HTML della pagina (no Firecrawl, no dipendenze esterne). La funzione:
- Riceve `{ session_id, urls, config }` via POST
- Per ogni URL: fetch HTML con timeout, parse con regex per email, telefoni italiani, link social (linkedin, facebook, instagram)
- Se `crawl_depth = "homepage_contacts"`: cerca anche link a pagine /contatti, /contact, /chi-siamo e le scansiona
- Aggiorna `scraping_jobs` con risultati (emails_found, phones_found, social_found, processing_time_ms)
- Aggiorna `scraping_sessions` status/progress
- Autenticazione via JWT header + service_role per write

**Integrazione in `ScraperWebsites.tsx`**: modificare `handleStart` per usare `supabase.functions.invoke("scrape-website", ...)` come fallback quando n8n non e configurato/raggiungibile (invece di bloccare l'utente).

**Config**: aggiungere `[functions.scrape-website] verify_jwt = false` a config.toml.

---

## Blocco 3: UX e Feature Parity

### 3a. Textarea multilinea (`WebScraperQueue.tsx`)
Sostituire `<Input>` (riga 63) con `<Textarea>` per supportare paste multilinea. Gestire Enter con Shift+Enter per newline, Enter solo per submit.

### 3b. Validazione URL (`WebScraperQueue.tsx`)
In `handleAddUrl`, validare ogni URL con regex: deve contenere almeno un dominio con TLD (es. `example.com`). Mostrare toast per URL invalidi scartati.

### 3c. Rate limit coda (`WebScraperQueue.tsx`)
Limitare a max 500 URL in coda. Mostrare warning toast se si supera il limite.

### 3d. Export CSV risultati (`WebScraperResults.tsx`)
Aggiungere bottone "ESPORTA CSV" nell'header dei risultati. Esporta i dati dei job completati (URL, email trovate, telefoni, social, tempo) come CSV diretto (senza passare da `exportContactsCsv`).

### 3e. Sessioni precedenti (`WebScraperPreviousSessions.tsx`)
Creare componente analogo a `MapsPreviousSessions` ma per sessioni `tipo = "website"`. Mostra data, numero URL, risultati. Click "Carica" ricarica jobs della sessione.

### 3f. Modal accessibile (`WebScraperDetailModal.tsx`)
Migrare da `div` fixed manuale a `<Dialog>` di Radix con `DialogContent`, `DialogHeader`. Mantiene tutto il contenuto interno identico.

### 3g. Ottimizzare enrichedContacts (`ScraperWebsites.tsx`)
Derivare `completedJobIds` con `useMemo` e usarlo come dependency dell'useEffect invece di `jobs` intero. Evita ri-fetch quando cambiano solo job queued/processing.

### 3h. Cache getN8nSettings (`ScraperWebsites.tsx`)
In `handleStart`, riutilizzare le settings gia caricate da `checkN8nHealth` passandole come parametro, evitando doppia query.

---

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/scrape-website/index.ts` | Nuovo |
| `supabase/config.toml` | Aggiunta entry |
| `src/pages/ScraperWebsites.tsx` | Fix user_id, fallback edge fn, memo |
| `src/components/scraper/WebScraperQueue.tsx` | Textarea, validazione, rate limit |
| `src/components/scraper/WebScraperResults.tsx` | Export CSV |
| `src/components/scraper/WebScraperPreviousSessions.tsx` | Nuovo |
| `src/components/scraper/WebScraperDetailModal.tsx` | Migrazione Dialog Radix |
| `src/services/n8n.ts` | Esporre settings da checkN8nHealth |

