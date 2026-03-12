

# Analisi Criticita — BuzzFinder Studio (Round 5)

I fix dei round 1-4 sono stati applicati correttamente. Restano le seguenti criticita residue.

---

## CRITICO

### 1. `scrape-maps-page` — legge `google_maps_api_key` senza filtro `user_id`

Riga 74-78: la query usa `service_role` e cerca `app_settings.chiave = 'google_maps_api_key'` senza `.eq("user_id", session.user_id)`. In ambiente multi-tenant, puo leggere la API key di un altro utente. Il `session.user_id` e gia disponibile (riga 47) ma non viene usato nel filtro.

**Fix**: aggiungere `.eq("user_id", session.user_id)` alla query `app_settings` su riga 77.

### 2. `send-reply` — usa `supabase.auth.getClaims()` che non esiste

Riga 29: `supabase.auth.getClaims(token)` non e un metodo del client Supabase JS v2. Il metodo corretto e `supabase.auth.getUser()`. Questa funzione fallira sempre con un errore, rendendo impossibile rispondere dall'Unibox.

**Fix**: sostituire con `supabase.auth.getUser()` ed estrarre `user.id` dal risultato, come fatto in `validate-emails`.

### 3. `track-open` — aperture duplicate non controllate

Riga 36-41: ogni volta che il pixel viene caricato (dal client email, proxy, prefetch), incrementa `campaign.aperti` senza verificare se quel `recipient_id` ha gia un `opened_at`. L'update su `campaign_recipients` e protetto dal filtro `.in("stato", ["sent", "delivered"])`, ma il contatore globale `campaigns.aperti` viene incrementato incondizionatamente. Risultato: le statistiche di apertura sono gonfiate.

**Fix**: prima dell'increment, controllare se `campaign_recipients.stato` era effettivamente aggiornato (cambiato) prima di incrementare il contatore globale, oppure usare `opened_at IS NULL` come condizione.

---

## IMPORTANTE

### 4. `process-sequence` — non filtra `campaigns.stato = 'in_corso'` nella query iniziale

Riga 161-174: la query seleziona `campaign_step_executions` con stato `"scheduled"`, e fa un join `inner` con `campaigns` ma **non filtra per `campaigns.stato = 'in_corso'`** nella query. Il filtro avviene solo dopo, nel loop (riga 197), dopo aver gia caricato e iterato sulla esecuzione. Questo e inefficiente e carica dati inutili.

**Fix**: aggiungere `.eq("campaigns.stato", "in_corso")` alla query principale per ridurre il dataset.

### 5. `campagna_avviata` — trigger senza cooldown/max_esecuzioni check

Riga 253-292 di `CampaignDetail.tsx`: quando si avvia una campagna, il codice inserisce direttamente le `automation_executions` senza verificare cooldown e max_esecuzioni_per_contatto. Se l'utente avvia/pausa/riavvia la campagna, le regole vengono triggerate ogni volta senza limiti.

**Fix**: aggiungere i check di cooldown e max_esecuzioni prima dell'inserimento, o meglio, delegare la logica al backend (edge function) per evitare bypass client-side.

### 6. `weekly-report` — nessun cron job schedulato

La funzione `weekly-report` non ha un cron job pg_cron configurato. Il report settimanale non viene mai inviato automaticamente.

**Fix**: aggiungere un cron job pg_cron per invocare `weekly-report` ogni lunedi mattina (es. `0 8 * * 1`).

### 7. `sender_pool.inviati_oggi` — nessun reset giornaliero

Il campo `inviati_oggi` viene incrementato ad ogni invio ma non c'e nessun meccanismo (cron, trigger, funzione schedulata) che lo resetti a 0 ogni giorno. Dopo il primo giorno di utilizzo, i mittenti esauriranno la capacita giornaliera e non invieranno piu.

**Fix**: aggiungere un cron job pg_cron giornaliero che esegua `UPDATE sender_pool SET inviati_oggi = 0, chiamate_oggi = 0 WHERE inviati_oggi > 0 OR chiamate_oggi > 0`.

---

## MODERATO

### 8. `Settings.tsx` riga 26 — `testN8n` ancora senza filtro `user_id`

Nonostante i fix precedenti, `testN8n` (riga 26) legge `n8n_instance_url` senza `.eq("user_id", ...)`. RLS protegge nel client, ma e incoerente con il pattern usato altrove.

### 9. `call_analytics` — vista senza RLS confermata

La tabella/vista `call_analytics` ha RLS abilitato ma zero policy (confermato dallo schema). Questo significa che nessun utente autenticato puo leggerla (default-deny con RLS on). Non e un rischio di sicurezza ma la rende inutilizzabile. Se serve, bisogna aggiungere una policy; se non serve, si puo eliminare.

### 10. `personalize-messages` — race condition su `ai_personalization_processed`

Riga 239-244: il contatore `ai_personalization_processed` viene aggiornato con `campaign.ai_personalization_processed + processed` dove `campaign` e stato letto all'inizio. Se due batch vengono lanciati in parallelo, il contatore sovrascrive il valore precedente invece di incrementarlo atomicamente.

**Fix**: usare una RPC o un raw SQL `SET ai_personalization_processed = ai_personalization_processed + 1` per un incremento atomico.

---

## Riepilogo

| # | Sev. | Problema |
|---|------|----------|
| 1 | CRITICO | `scrape-maps-page` legge API key senza filtro `user_id` |
| 2 | CRITICO | `send-reply` usa `getClaims()` inesistente — funzione rotta |
| 3 | CRITICO | `track-open` gonfia statistiche aperture (no dedup) |
| 4 | IMPORTANTE | `process-sequence` non filtra `in_corso` nella query SQL |
| 5 | IMPORTANTE | `campagna_avviata` trigger senza cooldown check |
| 6 | IMPORTANTE | `weekly-report` senza cron job |
| 7 | IMPORTANTE | `sender_pool.inviati_oggi` mai resettato |
| 8 | MODERATO | `testN8n` senza filtro `user_id` |
| 9 | MODERATO | `call_analytics` vista inaccessibile (RLS on, 0 policy) |
| 10 | MODERATO | `personalize-messages` race condition su contatore |

## Piano di Fix

1. **`scrape-maps-page`**: aggiungere `.eq("user_id", session.user_id)` alla query `google_maps_api_key`
2. **`send-reply`**: sostituire `getClaims()` con `getUser()` per estrarre `userId`
3. **`track-open`**: incrementare `campaigns.aperti` solo se il recipient non aveva gia `opened_at`
4. **`process-sequence`**: aggiungere filtro `campaigns.stato = 'in_corso'` nella query iniziale
5. **`campagna_avviata`**: aggiungere check cooldown/max_esecuzioni nel frontend o spostare logica a backend
6. **Cron job `weekly-report`**: schedule `0 8 * * 1` via pg_cron
7. **Cron job reset `inviati_oggi`**: schedule `0 0 * * *` con `UPDATE sender_pool SET inviati_oggi = 0, chiamate_oggi = 0`
8. **`Settings.tsx`**: aggiungere filtro `user_id` a `testN8n`
9. **`call_analytics`**: aggiungere RLS policy o eliminare la vista
10. **`personalize-messages`**: usare incremento atomico per `ai_personalization_processed`

