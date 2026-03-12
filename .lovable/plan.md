

# Analisi Criticita - BuzzFinder Studio (Round 2)

Dopo l'implementazione dei fix precedenti, ho analizzato tutto il codice corrente. Ecco le criticita residue e nuove trovate.

---

## CRITICO

### 1. `make-call` ha `verify_jwt = false` nel config.toml — la verifica ownership e bypassabile

In `config.toml` riga 37: `verify_jwt = false`. La Edge Function `make-call` tenta di verificare l'ownership del contatto leggendo il JWT dall'header Authorization, ma siccome `verify_jwt = false`, chiunque puo chiamare l'endpoint senza JWT valido. Il codice legge `contact.user_id` come fallback, ma un attaccante puo inviare richieste senza autenticazione e avviare chiamate su qualsiasi contatto nel DB (il service_role bypassa RLS).

**Fix**: cambiare `verify_jwt = true` in config.toml per `make-call`, oppure validare obbligatoriamente il JWT nel codice e rifiutare se assente.

### 2. `process-automations` ha `verify_jwt = false` — endpoint pubblico

Chiunque puo invocare `process-automations` e processare la coda di automazioni. Dovrebbe essere `verify_jwt = true` o protetto con un secret header.

### 3. CampaignDetail usa `"in_corso"` ma la specifica Fase 4 richiedeva `"attiva"`

`handleStatusChange` in CampaignDetail.tsx (riga 222) imposta `stato: "in_corso"`. Se le Edge Functions o automazioni cercano `"attiva"` come stato di campagna avviata, non troveranno mai nulla. Serve allineare tutti i riferimenti allo stesso valore.

---

## IMPORTANTE

### 4. `call-webhook` non inserisce `da_nome`/`da_email`/`da_telefono` nell'inbox_messages

Riga 226-239 di call-webhook: l'insert in `inbox_messages` non popola `da_nome`, `da_email`, `da_telefono`. Il contatto non viene caricato prima dell'insert. L'utente vedra messaggi senza mittente nell'Unibox.

**Fix**: caricare il contatto (`contacts.nome, azienda, telefono`) prima dell'insert e popolare `da_nome`, `da_telefono`.

### 5. Nessuna conferma prima di eliminare una regola di automazione

In Automations.tsx riga 251, il bottone "Elimina" chiama `deleteRule` direttamente senza AlertDialog di conferma. L'utente puo cancellare regole accidentalmente.

### 6. `tick` nel timer live di Calls.tsx non e usato nel render

Il `setInterval` incrementa `tick` (riga 172) ma `tick` non e referenziato nel JSX. React potrebbe non ri-renderizzare le righe della tabella live se nessun prop/state cambia effettivamente nella tabella. La durata live potrebbe non aggiornarsi.

**Fix**: usare `tick` come key o dependency nelle celle di durata, oppure usare `useReducer` per forzare il re-render.

### 7. `risposta_etichetta` nel wizard trigger non funziona

Automations.tsx: il trigger `risposta_ricevuta` con parametro `etichetta` e presente nei template (riga 60) ma il wizard non mostra un campo specifico per configurare l'etichetta quando si seleziona `risposta_ricevuta`. L'utente non puo creare regole basate sull'etichetta della risposta dal wizard.

### 8. Settings: il tab "Limiti" menzionato nella sidebar non esiste come tab separato

I campi limiti (riga 156-163) sono dentro il tab "Orari Invio", non in un tab "Limiti" dedicato come menzionato nella specifica originale. Non e un bug funzionale ma crea confusione con la documentazione.

---

## MODERATO

### 9. Backup sequenziale - performance degradata con molte tabelle

Settings.tsx riga 54: il backup scarica 27 tabelle in sequenza con `for...of`. Con tabelle grandi, questo puo richiedere minuti. Nessun indicatore di progresso oltre il generico "Esportazione...".

**Fix**: usare `Promise.all` per parallelizzare le query, aggiungere progress bar.

### 10. `campagna_avviata` non e mai triggerata come automazione

Il trigger `contatto_aggiunto` e `campagna_avviata` sono nell'UI del wizard (triggerConfig) ma nessun codice li triggera mai. Non ci sono punti nel flusso CampaignDetail o CampaignWizard che inseriscono `automation_executions` per questi trigger.

### 11. Wizard automazione: SelectItem per `chiamata_esito` con `value=""` iniziale

Automations.tsx riga 448: il Select per l'esito della chiamata usa `value={(triggerParams.esito as string) || ""}`. Quando `triggerParams.esito` e undefined, il valore e `""` che causa il bug Radix gia corretto altrove ma non qui.

### 12. `NewCallDialog` non resetta lo stato alla chiusura se si clicca fuori

Il dialog resetta lo stato solo su `handleSubmit` success (riga 518). Se l'utente chiude cliccando fuori o su "Annulla", i campi rimangono popolati alla prossima apertura.

---

## MINORE

### 13. `call_analytics` view/table senza RLS

La tabella `call_analytics` non ha policy RLS. Se e una vista materializzata, potrebbe esporre dati di tutti gli utenti. Non sembra essere usata nel codice frontend pero.

### 14. `assign-senders` ha `verify_jwt = false`

Un'altra Edge Function sensibile senza protezione JWT. Chiunque puo assegnare mittenti a campagne arbitrarie.

---

## Riepilogo

| # | Sev. | Problema |
|---|------|----------|
| 1 | CRITICO | `make-call` verify_jwt=false, chiamate senza auth |
| 2 | CRITICO | `process-automations` verify_jwt=false |
| 3 | CRITICO | Stato campagna `in_corso` vs `attiva` disallineato |
| 4 | IMPORTANTE | inbox_messages senza dati contatto da call-webhook |
| 5 | IMPORTANTE | Elimina regola senza conferma |
| 6 | IMPORTANTE | Timer live non aggiorna UI |
| 7 | IMPORTANTE | Trigger `risposta_etichetta` non configurabile nel wizard |
| 8 | IMPORTANTE | Tab Limiti dentro Orari |
| 9 | MODERATO | Backup sequenziale lento |
| 10 | MODERATO | Trigger `contatto_aggiunto`/`campagna_avviata` mai emessi |
| 11 | MODERATO | SelectItem value="" per esito chiamata |
| 12 | MODERATO | NewCallDialog non resetta stato |
| 13 | MINORE | `call_analytics` senza RLS |
| 14 | MINORE | `assign-senders` verify_jwt=false |

## Piano di Fix

1. **config.toml**: impostare `verify_jwt = true` per `make-call`, `process-automations`, `assign-senders`
2. **call-webhook**: caricare dati contatto prima di inserire in inbox_messages
3. **CampaignDetail**: allineare stato a `"attiva"` o confermare `"in_corso"` come standard
4. **Automations.tsx**: aggiungere AlertDialog per eliminazione, fix SelectItem value vuoto, aggiungere campo etichetta per trigger risposta
5. **Calls.tsx**: fix timer live con `tick` referenziato, reset NewCallDialog su chiusura
6. **Settings.tsx**: parallelizzare backup con Promise.all

