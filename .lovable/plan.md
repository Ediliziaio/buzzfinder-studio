

## Piano: Fix Bug Rimanenti (#06, #09, #10, #18-21)

### Bug #06 — Pausa scraping non notifica n8n
**File**: `src/pages/ScraperMaps.tsx`, `src/pages/ScraperWebsites.tsx`

Il pulsante PAUSA aggiorna solo lo stato in Supabase ma n8n continua a girare. Fix: nel `handlePause`, dopo l'update DB, inviare un webhook a n8n con `{ session_id, action: "pause" }`. Se il webhook fallisce, mostrare un avviso che la pausa è solo lato DB. Stesso approccio per entrambe le pagine. Aggiungere anche un webhook setting `n8n_webhook_control` per segnali di controllo, oppure riutilizzare il webhook esistente con un campo `action`.

**Approccio pragmatico**: dato che n8n potrebbe non supportare un endpoint di controllo dedicato, la soluzione migliore è far sì che il workflow n8n controlli lo stato della sessione in Supabase prima di ogni iterazione. Lato frontend, aggiungiamo un toast che spiega che n8n verificherà la pausa al prossimo ciclo.

---

### Bug #09 — Filtro tags non implementato in useContacts
**File**: `src/hooks/useContacts.ts`, `src/components/contacts/ContactFiltersBar.tsx`

Il tipo `ContactFilters` ha `tags?: string[]` ma `fetchContacts` non lo applica. Fix:
- In `useContacts.ts`: aggiungere `if (filters.tags?.length) { query = query.overlaps("tags", filters.tags); }` dopo gli altri filtri
- In `ContactFiltersBar.tsx`: aggiungere un input per filtrare per tag (combobox o input con chips)

---

### Bug #10 — Import Maps verso WebScraper carica sempre ultimi 500
**File**: `src/pages/ScraperWebsites.tsx`

`handleImportFromMaps` usa `.eq('fonte', 'google_maps')` senza sessione. Fix: aggiungere un parametro opzionale per il `scraping_session_id` e filtrare con `.eq('scraping_session_id', sessionId)`. Aggiungere UI per selezionare una sessione Maps specifica prima dell'import, usando le sessioni caricate da `useScrapingSessions`.

---

### Bug #18 — Step 'options' nel CSV wizard non implementato
**File**: `src/components/contacts/CsvImportDialog.tsx`

Il tipo `Step` include `"options"` ma non c'è UI. Fix: rimuovere `"options"` dal tipo (non serve uno step opzioni separato) oppure aggiungere un vero step con opzioni come: gestione duplicati (salta/aggiorna), stato default, tag da applicare. Implementeremo uno step leggero con: duplicati handling + tag opzionale.

---

### Bug #19 — useScrapingSessions limit 10
**File**: `src/hooks/useScrapingSession.ts`, `src/components/scraper/MapsPreviousSessions.tsx`

Fix: aggiungere paginazione "Carica altro" con offset incrementale. Cambiare da `.limit(10)` a un sistema con `page` state e bottone "Mostra precedenti".

---

### Bug #20 — VITE_SUPABASE_URL esposta in payload n8n
**File**: `src/pages/ScraperMaps.tsx`, `src/pages/ScraperWebsites.tsx`

Fix: rimuovere `supabase_url` dal payload. n8n dovrebbe avere l'URL configurato nelle proprie credenziali, non riceverlo dal client.

---

### Bug #21 — RLS multi-tenant assente
Questo è un cambiamento architetturale significativo (aggiungere `user_id` a tutte le tabelle + policy RLS). Per ora lo segnaleremo come nota ma non lo implementeremo in questo sprint — richiede una migrazione dati e cambio di tutte le query. Lo rimandiamo allo Sprint 3.

---

### Riepilogo modifiche

| File | Bug |
|------|-----|
| `src/hooks/useContacts.ts` | #09 |
| `src/components/contacts/ContactFiltersBar.tsx` | #09 |
| `src/pages/ScraperMaps.tsx` | #06, #20 |
| `src/pages/ScraperWebsites.tsx` | #06, #10, #20 |
| `src/components/contacts/CsvImportDialog.tsx` | #18 |
| `src/hooks/useScrapingSession.ts` | #19 |
| `src/components/scraper/MapsPreviousSessions.tsx` | #19 |

Bug #21 (RLS multi-tenant) e #22 (ErrorBoundary, già risolto) rimandati/completati.

