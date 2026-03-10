

## Sprint 1 — Fix dei Bug Critici

Il documento identifica 8 bug critici, 9 major e 5 minor. Questo piano copre tutti i bug critici e i major più impattanti, seguendo la roadmap suggerita.

---

### Fase 1: Pulsanti morti (Bug #01, #02, #03)

**BulkActionBar.tsx** — Collegare tutti i pulsanti (Email, SMS, WhatsApp, Stato, Tag, Aggiungi a Lista) ai rispettivi handler. Aggiungere callback props e implementare le azioni: cambio stato bulk, aggiunta a lista, avvio campagna con contatti selezionati.

**MapsResultsTable.tsx** — Collegare "Esporta CSV" a `exportContactsCsv()` (già esistente in `csvExporter.ts`). Collegare "Aggiungi a Lista" con dialog di selezione lista. Collegare "Scrapa Email" per inviare gli URL dei contatti selezionati al WebScraper.

---

### Fase 2: Isolamento sessioni scraping (Bug #04, #05)

**Migrazione DB**: Aggiungere colonna `scraping_session_id UUID REFERENCES scraping_sessions(id)` alla tabella `contacts`.

**ScraperMaps.tsx**: Filtrare i risultati con `.eq('scraping_session_id', currentSessionId)` invece di `.eq('fonte', 'google_maps')`.

**Realtime channel**: Aggiungere filtro `filter: 'scraping_session_id=eq.{sessionId}'` al channel Supabase per ricevere solo i contatti della sessione corrente.

---

### Fase 3: Paginazione contatti (Bug #07, #17)

**useContacts.ts**: Sostituire `.limit(500)` con paginazione cursor-based. Aggiungere parametri `page`/`pageSize` (default 50), conteggio totale, e navigazione next/prev.

**ContactsTable.tsx**: Aggiungere UI paginazione in fondo alla tabella con indicatore "Pagina X di Y — N contatti totali".

**CampaignDetail.tsx**: Stessa paginazione per la tabella destinatari.

---

### Fase 4: Fix timer e cleanup sessioni (Bug #16, #13)

**MapsProgressBox.tsx**: Aggiungere `setInterval` ogni secondo per aggiornare il timer elapsed in tempo reale.

**ScraperMaps.tsx / ScraperWebsites.tsx**: Nel `catch` di `handleStart`, aggiornare la sessione appena creata a `status='failed'` per evitare sessioni bloccate in "pending".

---

### Fase 5: Bug Major prioritari (Bug #11, #12, #14, #15)

**appStore.ts** (Bug #11): Leggere i crediti reali dal database (`usage_log` + `app_settings`) invece dei valori hardcoded.

**CampaignDetail.tsx** (Bug #12): Validare che `campaign_recipients` contenga almeno 1 record prima di permettere il lancio.

**validators/contact.ts** (Bug #14): Accettare numeri internazionali (non solo +39) nel validator Zod, allineandolo con `phoneNormalizer.ts`.

**emailValidator.ts** (Bug #15): Rimuovere la penalizzazione per `info@` e `sales@` — sono email B2B legittime nel contesto italiano.

---

### Fase 6: Index page + ErrorBoundary (Bug #08, #22)

**Index.tsx**: Sostituire il placeholder con redirect diretto a `/contacts` o una dashboard riepilogativa.

**App.tsx**: Aggiungere `ErrorBoundary` globale con fallback UI che mostra messaggio di errore e pulsante "Ricarica".

---

### Riepilogo impatto

| Fase | Bug risolti | Stima |
|------|------------|-------|
| 1 — Pulsanti morti | #01, #02, #03 | ~5h |
| 2 — Isolamento sessioni | #04, #05 | ~4h |
| 3 — Paginazione | #07, #17 | ~4h |
| 4 — Timer + cleanup | #16, #13 | ~2h |
| 5 — Bug major | #11, #12, #14, #15 | ~4h |
| 6 — Index + ErrorBoundary | #08, #22 | ~1h |

Totale: ~20 ore di lavoro, 14 bug risolti. Dopo questo sprint l'app sarà utilizzabile in produzione.

> I bug minor (#18, #19, #20, #21) e i miglioramenti (Scraping multi-città, sequenze follow-up, scheduling, tracking pixel, ecc.) saranno affrontati negli Sprint 2 e 3.

