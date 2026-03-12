

# Piano: Gestione stato "paused" con checkpoint e resume

## Modifiche

### 1. Migration SQL — campo `interrupted_at`
Aggiungere `interrupted_at timestamptz` alla tabella `scraping_sessions` per tracciare interruzioni forzate.

### 2. Edge function `scrape-website/index.ts`

**Check pausa mid-subpage**: Modificare `scrapeUrl` per accettare `session_id` e `sb` client. Nel loop delle sottopagine (`extractContactPageLinks`), dopo ogni fetch controllare lo stato sessione. Se `paused`/`completed`, salvare risultati parziali (email/phone/social trovati fino a quel punto) e lanciare un errore `InterruptedError`.

**Gestione nel loop principale**: Quando un job viene interrotto per pausa, salvarlo come `status: "queued"` (non `failed`) con i dati parziali, e settare `interrupted_at` sulla sessione. Quando la sessione è `completed` (stop forzato), marcare i job `processing` residui come `queued`.

**Dopo il loop**: Non sovrascrivere lo status a `completed` se la sessione è `paused` — lasciare lo stato com'è.

### 3. `ScraperWebsites.tsx`

**Stato visivo pausa**: Aggiungere stato derivato `isPausing` (session status === `paused` ma ci sono ancora job in `processing`). Passare `isPausing` al `WebScraperQueue` per mostrare indicatore "In pausa...".

**Resume con reset stale jobs**: Aggiungere `handleResume` che:
1. Resetta job in stato `processing` (da >2 minuti) a `queued`
2. Aggiorna sessione a `status: "running"`, `resumed_at: now()`
3. Ri-invoca la edge function `scrape-website` con lo stesso `session_id`

**Stop con `interrupted_at`**: Nel `confirmStop`, settare anche `interrupted_at` e resettare job `processing`/`queued` residui.

### 4. `WebScraperQueue.tsx`

Aggiungere prop `isPausing` e `onResume`. Quando `isPausing` è true, mostrare spinner + testo "In pausa..." al posto del bottone Pausa. Aggiungere bottone "Riprendi" visibile quando `session.status === "paused"` e non ci sono job processing.

## File coinvolti

| File | Modifiche |
|------|-----------|
| Migration SQL | `ALTER TABLE scraping_sessions ADD COLUMN interrupted_at timestamptz` |
| `supabase/functions/scrape-website/index.ts` | Check pausa mid-subpage, salvataggio parziale, no overwrite status se paused |
| `src/pages/ScraperWebsites.tsx` | `isPausing` derivato, `handleResume` con reset stale jobs, stop con `interrupted_at` |
| `src/components/scraper/WebScraperQueue.tsx` | Props `isPausing`/`onResume`, UI pausa/riprendi |

