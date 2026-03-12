

# Analisi Criticita - BuzzFinder Studio (Round 3)

Dopo i due round di fix precedenti, il sistema e significativamente migliorato. Restano le seguenti criticita.

---

## CRITICO

### 1. `config.toml` — `make-call` e `process-automations` ancora con `verify_jwt = false`

Nonostante i fix nel codice (validazione JWT interna), il file `config.toml` righe 36-43 ha ancora `verify_jwt = false` per `make-call` e `process-automations`. Secondo la documentazione del progetto, `verify_jwt = false` e la configurazione corretta perche il sistema usa signing-keys e la validazione avviene nel codice. Tuttavia, la validazione interna in `process-automations` non isola per `user_id`: la query a riga 54-59 seleziona TUTTE le `automation_executions` pending senza filtro `user_id`, processando esecuzioni di qualsiasi utente. Questo e un problema di isolamento multi-tenant.

**Fix**: aggiungere `.eq("user_id", userId)` alla query di selezione pending, oppure filtrare dopo aver estratto l'utente dal JWT.

### 2. `ElevenLabsTestButton` — legge API key senza filtro `user_id`

Settings.tsx riga 415: `supabase.from("app_settings").select("valore").eq("chiave", "elevenlabs_api_key").maybeSingle()` NON filtra per `user_id`. Con RLS attiva, funziona solo se l'utente ha una sola chiave — ma se il client non invia il JWT (bug), oppure in un contesto admin, potrebbe leggere dati altrui. Stessa issue per `BlocklistEditor` (riga 315), `AiModelSelector` (riga 342), `AnthropicModelSelect` (riga 379) — tutti leggono senza `.eq("user_id", ...)`. RLS protegge nel client-side, ma e una cattiva pratica e fragile.

**Fix**: Non urgente (RLS protegge), ma sarebbe corretto aggiungere il filtro esplicito per coerenza e sicurezza difensiva.

### 3. `call-webhook` — `triggerAutomazioni` non filtra per `esito` specifico nelle regole `chiamata_esito`

Riga 263-268 di `call-webhook`: quando triggera regole per `chiamata_esito`, passa `esito` nel contesto ma la query a riga 291-304 filtra solo per `trigger_tipo = "chiamata_esito"` senza confrontare `trigger_params.esito` con l'esito effettivo. Risultato: una regola configurata per triggerarsi su `esito = "appuntamento"` si attiva anche su `esito = "non_interessato"`.

**Fix**: dopo aver caricato le regole, filtrare quelle dove `rule.trigger_params.esito` corrisponde a `contesto.esito` (o e undefined/null per "qualsiasi esito").

---

## IMPORTANTE

### 4. `process-automations` — `cambia_pipeline_stage` fallisce silenziosamente se `campaign_id` e null

Riga 127-135: fa `.eq("campaign_id", exec.campaign_id)`. Se `exec.campaign_id` e null (regola globale), la query non trova nulla perche `.eq("campaign_id", null)` non corrisponde a nulla in PostgREST — servrebbe `.is("campaign_id", null)`. Ma il vero problema e che senza campaign_id non si sa quale recipient aggiornare.

**Fix**: se `campaign_id` e null, loggare un warning e skippare, oppure cercare il recipient piu recente per quel contatto.

### 5. Nessun cron/scheduler per `process-automations`

Le automazioni pending non vengono mai processate automaticamente. Non c'e nessun trigger, cron job, o pg_cron che invochi `process-automations` periodicamente. Le esecuzioni rimangono in stato "pending" indefinitamente, a meno che qualcuno non chiami manualmente l'endpoint.

**Fix**: aggiungere un bottone "Processa coda" nella pagina Automazioni, e/o documentare che serve un cron esterno (es. n8n ogni 5 min).

### 6. `Calls.tsx` — la ricerca contatti nell'NewCallDialog non filtra per `telefono_dnc`

Riga 496-501: la ricerca per la nuova chiamata cerca contatti con telefono non null ma non esclude quelli con `telefono_dnc = true`. L'utente puo selezionare un contatto DNC e ricevera un errore solo dopo aver cliccato "Avvia chiamata".

**Fix**: aggiungere `.neq("telefono_dnc", true)` alla query, o almeno mostrare un badge di warning.

---

## MODERATO

### 7. `call-webhook` — `triggerAutomazioni` per `risposta_etichetta` mai implementato

Il wizard automazioni permette di creare regole con trigger `risposta_ricevuta` + etichetta specifica, ma il `call-webhook` triggera solo `chiamata_completata` e `chiamata_esito`. Nessuna edge function triggera `risposta_ricevuta` o `risposta_etichetta`. Queste regole non si attiveranno mai.

**Fix**: implementare il trigger nel `handle-reply` edge function, o documentare che non e ancora supportato.

### 8. `CampaignDetail` — stato `"in_corso"` incoerente

Il sistema usa `"in_corso"` come stato attivo (CampaignDetail riga 222, 244) ma la specifica originale richiedeva `"attiva"`. Non e un bug funzionale perche non ci sono CHECK constraint, ma crea confusione. Le edge functions (`process-sequence`, ecc.) dovrebbero usare lo stesso valore per filtrare campagne attive.

### 9. Modello Anthropic hardcoded nel `call-webhook`

Riga 37 di `call-webhook`: il modello Anthropic e hardcoded `claude-haiku-4-5-20251001`. Il campo `ai_model_attivo` configurato in Settings non viene letto. L'utente potrebbe pensare di aver cambiato modello ma la classificazione usa sempre Haiku.

**Fix**: leggere `ai_model_attivo` da app_settings e usarlo nella chiamata Anthropic.

### 10. `process-automations` segna come "completed" anche azioni skippate

Riga 234-238: quando un'azione non e implementata (es. `invia_email`), il risultato contiene `{ skipped: true }` ma lo stato viene comunque aggiornato a `"completed"`. Questo e fuorviante nel log — l'utente vede "OK" ma l'azione non e stata eseguita.

**Fix**: usare stato `"skipped"` per azioni non implementate.

---

## Riepilogo

| # | Sev. | Problema |
|---|------|----------|
| 1 | CRITICO | `process-automations` processa pending di tutti gli utenti |
| 2 | CRITICO | Settings leggono app_settings senza filtro user_id (RLS mitiga) |
| 3 | CRITICO | `chiamata_esito` non filtra per esito specifico della regola |
| 4 | IMPORTANTE | `cambia_pipeline_stage` fallisce con campaign_id null |
| 5 | IMPORTANTE | Nessun cron per process-automations |
| 6 | IMPORTANTE | Ricerca contatti non filtra DNC |
| 7 | MODERATO | Trigger `risposta_ricevuta` mai emesso da nessuna EF |
| 8 | MODERATO | Stato campagna `in_corso` vs `attiva` |
| 9 | MODERATO | Modello Anthropic hardcoded nel webhook |
| 10 | MODERATO | Azioni skippate marcate come "completed" |

## Piano di Fix

1. `process-automations`: filtrare pending per user_id dal JWT, oppure processare per-user
2. `call-webhook/triggerAutomazioni`: filtrare regole `chiamata_esito` per `trigger_params.esito`
3. `Calls.tsx`: filtrare contatti DNC nella ricerca
4. `process-automations`: usare stato `"skipped"` per azioni non implementate
5. `call-webhook`: leggere `ai_model_attivo` da app_settings
6. Aggiungere bottone "Processa coda automazioni" nella pagina Automations
7. `process-automations`: gestire `campaign_id` null nel `cambia_pipeline_stage`

