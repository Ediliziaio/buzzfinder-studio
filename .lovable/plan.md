

# Analisi Criticita — Sistema Scraper Siti Web

## CRITICO

### 1. Nessuna Edge Function per lo scraping siti — dipendenza totale da n8n esterno

Il sistema siti web **non ha una edge function** propria. Tutta la logica di scraping (fetch HTML, parsing email/telefoni/social) e delegata a n8n tramite webhook (`triggerN8nWebhook`). Se n8n non e configurato o non raggiungibile, lo scraper siti e completamente inutilizzabile. Il sistema Maps invece ha `scrape-maps-page` come edge function autonoma.

**Impatto**: L'intero flusso siti dipende da un servizio esterno senza fallback. Non c'e nessun codice backend che effettivamente fa lo scraping.

**Fix**: Creare una edge function `scrape-website` che usa Firecrawl (connector disponibile) per estrarre email, telefoni e social da un sito web. Aggiungere un fallback: se n8n non e configurato, usare la edge function direttamente.

### 2. Contact matching query senza filtro `user_id`

Riga 192-196 di `ScraperWebsites.tsx`: la query per trovare contatti corrispondenti agli URL carica **tutti** i contatti con `sito_web` non null, senza `.eq("user_id", userId)`. In ambiente multi-tenant, un utente potrebbe associare i propri URL ai contatti di un altro utente.

**Fix**: Aggiungere `.eq("user_id", userId)` alla query di contact matching.

### 3. Jobs insert senza `user_id` — nessun modo per RLS di proteggere

Riga 206-216: i job vengono inseriti con `session_id` ma la tabella `scraping_jobs` non ha una colonna `user_id`. La RLS usa `user_owns_scraping_session(session_id)` che funziona, ma ogni query richiede un join implicito. Il problema e che il job retry (riga 268-282) non verifica che l'utente possieda il job prima di aggiornarlo — il `.eq("id", job.id)` passa solo perche RLS lo protegge, ma se RLS fosse bypassato (service_role), non c'e protezione.

**Severita**: Moderata (RLS protegge, ma pattern fragile).

### 4. `handleImportFromMaps` non filtra per `user_id`

Riga 120-138: quando `mapsSessionIdForImport` e null, la query carica contatti con `fonte = "google_maps"` senza filtro `user_id`. RLS protegge nel client, ma il pattern e incoerente e fragile.

**Fix**: Aggiungere filtro esplicito `user_id`.

---

## IMPORTANTE

### 5. Nessuna validazione URL in input

`handleAddUrl` (riga 39-43) accetta qualsiasi stringa. Non c'e validazione che l'input sia un URL valido. Stringhe come "ciao", "123" vengono aggiunte alla coda e inviate a n8n, che fallira.

**Fix**: Validare con regex o `new URL()` prima di aggiungere.

### 6. `enrichedContacts` ricalcolati ad ogni cambio di `jobs`

Riga 82-100: l'`useEffect` che carica i contatti arricchiti viene triggerato ad **ogni aggiornamento** di qualsiasi job (anche status change da `queued` a `processing`). Dovrebbe triggerare solo quando cambiano i job `completed`.

**Fix**: Usare un `useMemo` per derivare `completedJobsWithContact` e usare quello come dependency.

### 7. Nessun export CSV per risultati scraper siti

A differenza di `MapsResultsTable` che ha un bottone export, `WebScraperResults` non ha alcuna funzionalita di export. I risultati sono visibili solo nell'interfaccia.

### 8. Sessioni precedenti non visibili

Non c'e un pannello "Sessioni precedenti" per lo scraper siti (come `MapsPreviousSessions` per Maps). L'utente perde accesso ai risultati quando chiude la pagina.

### 9. `WebScraperQueue` URL input non supporta textarea multilinea

L'input URL (riga 57-64 di Queue) e un `<Input>` single-line. Il placeholder dice "uno per riga" ma il componente non supporta multilinea. L'unico modo per separare e `\n` che viene gestito nel codice, ma l'utente non puo inserire newline in un `<Input>`.

**Fix**: Usare `<Textarea>` invece di `<Input>`.

---

## MODERATO

### 10. `getN8nSettings` chiamata 2 volte durante lo start

In `handleStart` (riga 219-233), `getN8nSettings()` viene chiamata per ottenere il webhook path. Ma `checkN8nHealth()` (riga 163) chiama gia `getN8nSettings()` internamente. Sono 2 query duplicate a `app_settings`.

### 11. Nessun rate limiting sulla coda

Non c'e limite al numero di URL che un utente puo aggiungere alla coda. 10.000 URL verrebbero tutti inviati a n8n in un singolo payload, potenzialmente causando timeout o crash.

### 12. `WebScraperDetailModal` non usa Dialog/Sheet standard

Il modal di dettaglio usa un `div` fixed con backdrop manuale invece dei componenti `Dialog` di Radix. Manca gestione keyboard (Escape), focus trap, e accessibilita.

---

## Riepilogo

| # | Sev. | Problema |
|---|------|----------|
| 1 | CRITICO | Nessuna edge function — dipendenza totale da n8n |
| 2 | CRITICO | Contact matching senza filtro `user_id` |
| 3 | MODERATO | Jobs insert senza `user_id` diretto — pattern fragile |
| 4 | IMPORTANTE | `handleImportFromMaps` senza filtro `user_id` |
| 5 | IMPORTANTE | Nessuna validazione URL input |
| 6 | IMPORTANTE | `enrichedContacts` ricalcolati troppo spesso |
| 7 | IMPORTANTE | Nessun export CSV risultati |
| 8 | IMPORTANTE | Nessun pannello sessioni precedenti |
| 9 | IMPORTANTE | Input URL single-line invece di textarea |
| 10 | MODERATO | `getN8nSettings` chiamata 2 volte |
| 11 | MODERATO | Nessun rate limiting sulla coda URL |
| 12 | MODERATO | Modal non accessibile (no Dialog Radix) |

## Piano di Fix

1. **Edge function `scrape-website`**: Creare usando Firecrawl per estrarre email/telefoni/social dal markdown. Aggiungere logica fallback in `handleStart` se n8n non configurato.
2. **Filtri `user_id`**: Aggiungere a contact matching (riga 192) e `handleImportFromMaps` (riga 120).
3. **Validazione URL**: Aggiungere `try { new URL(...) }` prima di inserire in coda.
4. **Textarea multilinea**: Sostituire `<Input>` con `<Textarea>` nel URL input.
5. **Ottimizzare `enrichedContacts`**: Derivare lista completed con `useMemo` e usare come dep.
6. **Export CSV**: Aggiungere bottone export in `WebScraperResults` che filtra per `session_id`.
7. **Sessioni precedenti**: Creare componente `WebScraperPreviousSessions` analogo a Maps.
8. **Modal accessibile**: Migrare `WebScraperDetailModal` a `Dialog` di Radix.
9. **Cache `getN8nSettings`**: Passare settings gia caricati da `checkN8nHealth` a `handleStart`.
10. **Rate limit coda**: Aggiungere limite max 500 URL con warning.

