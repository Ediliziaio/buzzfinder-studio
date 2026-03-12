

# Analisi Criticita — BuzzFinder Studio (Round 4)

I fix dei round precedenti sono stati applicati correttamente. Restano le seguenti criticita residue.

---

## CRITICO

### 1. `process-sequence` non filtra per `user_id` e `getAppSetting` non filtra per `user_id`

`process-sequence/index.ts` riga 21-28: la funzione `getAppSetting` non accetta `userId` come parametro — cerca `app_settings` senza filtro `user_id`, quindi in ambiente multi-tenant con service_role puo leggere impostazioni di un altro utente. Inoltre la query principale (riga 86-98) non filtra le esecuzioni per `user_id` del proprietario della campagna.

**Fix**: aggiungere parametro `userId` a `getAppSetting` in `process-sequence`, e fare `.eq("user_id", userId)` come gia fatto in `process-automations` e `call-webhook`.

### 2. `process-sequence` marca come "sent" senza inviare realmente

Riga 252-256: il sistema aggiorna lo stato a `"sent"` e incrementa le statistiche, ma **non esegue l'invio effettivo**. Non c'e nessuna chiamata a Resend, n8n, o qualsiasi altro provider di invio. I messaggi vengono marcati come inviati senza essere mai spediti.

**Fix**: integrare la chiamata Resend (o n8n webhook) prima di marcare come "sent", oppure aggiungere un commento/warning esplicito che l'invio e delegato a n8n.

### 3. `handle-reply` non triggera automazioni `risposta_ricevuta`

La Edge Function `handle-reply` (che riceve le risposte email) classifica il messaggio con AI e lo salva in `inbox_messages`, ma NON inserisce mai `automation_executions` per le regole con trigger `risposta_ricevuta`. L'utente puo creare regole per "quando arriva una risposta interessata → chiama il contatto", ma queste regole non si attiveranno mai.

**Fix**: aggiungere in `handle-reply` una funzione `triggerAutomazioni` simile a quella in `call-webhook`, che inserisca esecuzioni pending per le regole `risposta_ricevuta` filtrate per etichetta.

---

## IMPORTANTE

### 4. `assign-senders` non verifica ownership della campagna

Riga 61-72: la funzione carica la campagna con `.eq("id", campaign_id).single()` senza controllare che l'utente autenticato (estratto dal JWT a riga 42-49) sia il proprietario. Un utente autenticato potrebbe assegnare mittenti a campagne di un altro utente.

**Fix**: confrontare `campaign.user_id` con l'utente estratto dal JWT (come fatto in `make-call`).

### 5. `call_analytics` senza RLS — vista accessibile a tutti

La tabella/vista `call_analytics` non ha policy RLS (confermato dallo schema). Non e usata nel frontend, ma se qualcuno la interroga direttamente espone dati di tutti gli utenti (campaign_id, totale_chiamate, costo_totale, ecc.).

**Fix**: aggiungere RLS o eliminare la tabella se non necessaria.

### 6. `process-sequence` non ha cron job schedulato

Come `process-automations`, anche `process-sequence` non ha un cron job pg_cron che lo invochi periodicamente. Le campagne in `in_corso` con step schedulati non vengono mai processate automaticamente.

**Fix**: aggiungere un cron job pg_cron ogni 2-3 minuti per `process-sequence`.

### 7. Stato campagna `in_corso` confermato come standard — ma non documentato

`process-sequence` riga 120 usa `"in_corso"` per filtrare campagne attive, `CampaignDetail` riga 244 imposta `"in_corso"`. E coerente. La confusione con `"attiva"` della specifica originale e risolta de facto, ma non c'e un'enum o constraint che impedisca valori errati.

---

## MODERATO

### 8. Trigger `contatto_aggiunto` e `campagna_avviata` mai emessi

I trigger `contatto_aggiunto` e `campagna_avviata` sono presenti nel wizard automazioni (righe 35-36 di Automations.tsx) come opzioni selezionabili, ma nessuna parte del codice (ne frontend ne edge functions) emette mai questi trigger. Le regole create con questi trigger non si attiveranno mai.

**Fix**: emettere `contatto_aggiunto` quando si aggiungono recipient in CampaignDetail/CampaignWizard, e `campagna_avviata` in `handleStatusChange`.

### 9. `testN8n` in Settings non filtra per `user_id`

Riga 26 di Settings.tsx: `supabase.from("app_settings").select("valore").eq("chiave", "n8n_instance_url").maybeSingle()` — non filtra per `user_id`. RLS protegge, ma se l'utente ha piu record (impossibile con unique constraint) o se RLS viene bypassata, potrebbe leggere dati errati.

### 10. `ElevenLabsTestButton` variabile `user` oscura il parametro esterno

Riga 431 di Settings.tsx: `const user = await res.json()` ri-dichiara `user` gia usata a riga 424 (`const { data: { user } } = await supabase.auth.getUser()`). Non e un bug funzionale perche il primo `user` non serve piu a quel punto, ma e confuso.

---

## Riepilogo

| # | Sev. | Problema |
|---|------|----------|
| 1 | CRITICO | `process-sequence` getAppSetting senza user_id |
| 2 | CRITICO | `process-sequence` marca "sent" senza inviare |
| 3 | CRITICO | `handle-reply` non triggera automazioni `risposta_ricevuta` |
| 4 | IMPORTANTE | `assign-senders` non verifica ownership campagna |
| 5 | IMPORTANTE | `call_analytics` senza RLS |
| 6 | IMPORTANTE | `process-sequence` senza cron job |
| 7 | IMPORTANTE | Stato `in_corso` confermato ma senza constraint |
| 8 | MODERATO | Trigger `contatto_aggiunto`/`campagna_avviata` mai emessi |
| 9 | MODERATO | `testN8n` senza filtro user_id |
| 10 | MODERATO | Shadowing variabile `user` in ElevenLabsTestButton |

## Piano di Fix

1. **`process-sequence`**: aggiungere `userId` a `getAppSetting`, estrarre user_id dalla campagna e passarlo alle query. Aggiungere commento/TODO sull'invio effettivo mancante.
2. **`handle-reply`**: aggiungere funzione `triggerAutomazioni` che inserisca esecuzioni pending per regole `risposta_ricevuta` filtrando per `etichetta` se configurata.
3. **`assign-senders`**: verificare che `campaign.user_id` corrisponda all'utente JWT (skip per service_role).
4. **`call_analytics`**: aggiungere RLS policy basata su `user_id` tramite la campagna, o eliminare la tabella.
5. **Cron job `process-sequence`**: aggiungere pg_cron schedule ogni 3 minuti.
6. **`Settings.tsx`**: aggiungere filtro user_id a `testN8n`, rinominare variabile `user` in `ElevenLabsTestButton`.
7. **Trigger mancanti**: emettere `contatto_aggiunto` nel wizard/CampaignDetail quando si aggiungono recipient.

