

# Analisi Criticità BuzzFinder Studio

## Criticità Trovate

### 1. CRITICO — `getAppSetting` nelle Edge Functions ignora `user_id`

**File**: `make-call/index.ts`, `call-webhook/index.ts`, `process-automations/index.ts`

La funzione helper `getAppSetting` fa `.maybeSingle()` senza filtrare per `user_id`. Siccome la tabella `app_settings` ha RLS con `user_id = auth.uid()` e le edge function usano `service_role` (che bypassa RLS), se due utenti configurano la stessa chiave, `.maybeSingle()` restituirà errore (multiple rows). La query deve filtrare per `user_id` del contatto o dell'utente proprietario della sessione.

**Fix**: passare `user_id` a `getAppSetting` e aggiungere `.eq("user_id", userId)`.

---

### 2. CRITICO — `call-webhook` salva in `inbox_messages` con `canale: "email"`

**File**: `call-webhook/index.ts` riga 222

La trascrizione della chiamata AI viene salvata nell'inbox come `canale: "email"` con commento "fallback since 'chiamata' may not be in CHECK constraint". Il DB in realtà **non ha un CHECK constraint** su `canale` (è un semplice `text DEFAULT 'email'`), quindi si potrebbe usare `"chiamata"`. Ma anche se lo si lascia come `"email"`, è fuorviante per l'utente nell'Unibox. Nella pagina Unibox, il filtro canale e le icone mostreranno un'email invece di una chiamata.

**Fix**: usare `canale: "chiamata"` nel webhook.

---

### 3. IMPORTANTE — `make-call` usa service_role globale, nessun isolamento multi-tenant

**File**: `make-call/index.ts`

La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS) per leggere contatti e app_settings. Se il `contact_id` appartiene a un altro utente, la chiamata verrà comunque effettuata. Non c'è nessun controllo che l'utente autenticato sia il proprietario del contatto.

**Fix**: estrarre il `user_id` dal JWT (o dal contatto), e verificare che il contatto appartenga all'utente autenticato prima di procedere.

---

### 4. IMPORTANTE — CampaignDetail usa `"in_corso"` ma il DB check constraint usa `"attiva"`?

**File**: `CampaignDetail.tsx` riga 222, 250

La `CampaignStato` nel types è `'in_corso'` e il codice imposta `stato: "in_corso"`. Tuttavia la specifica delle fasi precedenti menzionava `"attiva"` come stato di avvio. Il DB non ha un CHECK constraint (il campo `stato` è `text DEFAULT 'bozza'`), ma c'è un'inconsistenza con le istruzioni della Fase 4 che richiedevano `"attiva"` anziché `"in_corso"`.

**Impatto**: potenziale disallineamento se edge functions o automazioni cercano uno stato specifico.

---

### 5. IMPORTANTE — Analytics nella pagina Calls fa 7 query sequenziali

**File**: `Calls.tsx` righe 127-141

`fetchChart` esegue 7 query Supabase sequenziali (una per giorno) per costruire il grafico. Questo è lento e spreca quota API.

**Fix**: fare una singola query con `.gte("created_at", 7_days_ago)` e raggruppare i risultati lato client.

---

### 6. MODERATO — `Automations.tsx` Select `value=""` per "Tutte le campagne"

**File**: `Automations.tsx` riga 560

Radix UI `SelectItem` con `value=""` causa problemi (valore vuoto non supportato). Questo può impedire la deselezione della campagna.

**Fix**: usare `value="__all__"` e mappare a `null` prima del salvataggio.

---

### 7. MODERATO — Race condition nel timer live di Calls

**File**: `Calls.tsx` riga 164

Il `setInterval` da 5 secondi incrementa `tick` per forzare il re-render e aggiornare la durata live. Ma `tick` non è usato da nessun componente — il re-render avviene, ma `liveDurata()` ricalcola usando `Date.now()`, che funziona solo perché il componente re-renderizza. Se React ottimizza e non re-renderizza le righe della tabella, la durata non si aggiornerà. Funziona per ora, ma è fragile.

---

### 8. MODERATO — Anthropic API key duplicata in Settings

**File**: `Settings.tsx`

`anthropic_api_key` appare sia nel tab "API Keys" (riga 98) che nel tab "AI & Chiamate" (riga 219). L'utente potrebbe configurarla in un posto e non nell'altro, causando confusione.

**Fix**: rimuoverla da uno dei due tab, o mostrare un cross-link.

---

### 9. MODERATO — `call-webhook` è pubblico ma non valida l'origine

**File**: `call-webhook/index.ts`, `config.toml` riga 39-40

`verify_jwt = false` e nessun controllo sull'header o firma di ElevenLabs. Chiunque conosca l'URL può inviare webhook falsi e inserire dati fittizi (sessioni completate, esiti, trascrizioni). ElevenLabs non firma i webhook con HMAC.

**Fix**: almeno verificare che `elevenlabs_call_id` corrisponda a una sessione esistente nel DB (questo viene già fatto), ma qualcuno potrebbe comunque aggiornare sessioni reali con dati falsi se indovina l'ID.

---

### 10. MINORE — `process-automations` non gestisce `invia_email` e `aggiungi_a_sequenza`

**File**: `process-automations/index.ts` righe 63-193

Le azioni `invia_email` e `aggiungi_a_sequenza` sono elencate nei CHECK constraint del DB e nell'UI dell'Automations wizard (`azioneConfig`), ma il `switch` nell'edge function non le gestisce. Cadono nel `default` e vengono skippate silenziosamente.

---

### 11. MINORE — `costo_eur` nel DB è `numeric` ma la UI lo tratta come `number`

Il campo `costo_eur` dalla tabella `call_sessions` è `numeric(8,4)` che Supabase restituisce come stringa. Il codice fa `(c.costo_eur || 0).toFixed(2)` che funziona per caso perché JS converte la stringa, ma `Number(c.costo_eur)` sarebbe più esplicito.

---

## Riepilogo Priorità

| # | Severità | Problema |
|---|----------|----------|
| 1 | CRITICO | `getAppSetting` senza `user_id` — collisioni multi-tenant |
| 2 | CRITICO | Chiamate salvate in inbox come `canale: "email"` |
| 3 | IMPORTANTE | `make-call` senza verifica proprietà contatto |
| 4 | IMPORTANTE | Stato campagna `in_corso` vs `attiva` incoerente |
| 5 | IMPORTANTE | 7 query sequenziali per analytics chart |
| 6 | MODERATO | `SelectItem value=""` — bug Radix |
| 7 | MODERATO | Timer live fragile |
| 8 | MODERATO | Anthropic API key duplicata nei Settings |
| 9 | MODERATO | Webhook call-webhook senza autenticazione |
| 10 | MINORE | Azioni `invia_email` e `aggiungi_a_sequenza` non implementate |
| 11 | MINORE | `numeric` trattato come `number` |

## Piano di Fix

Correggerò tutti i problemi in ordine di severità, con focus su:
1. Aggiungere `user_id` filtering a `getAppSetting` in tutte le edge functions
2. Cambiare `canale: "chiamata"` nel call-webhook
3. Aggiungere verifica ownership in make-call
4. Ottimizzare la query analytics in Calls.tsx
5. Fix `SelectItem value=""` in Automations.tsx
6. Rimuovere duplicazione anthropic_api_key in Settings
7. Fare cast espliciti per numeric

