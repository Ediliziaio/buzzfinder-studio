

# Piano: Guida Webhook in Settings + Thread Completo in Unibox

## Task 1 — Aggiungere tab "Ricezione Risposte" nelle Impostazioni

**File da modificare:** `src/pages/Settings.tsx`

Aggiungere un nuovo tab `ricezione` nella TabsList che contiene una guida step-by-step con 3 metodi di configurazione (Resend Inbound, n8n + IMAP, Webhook Manuale), ognuno in un sotto-tab con istruzioni numerate, URL endpoint copiabile e payload JSON di esempio.

L'URL dell'endpoint sara' costruito dinamicamente da `import.meta.env.VITE_SUPABASE_URL` + `/functions/v1/handle-reply`. Include un bottone "Copia" per l'URL e il payload JSON.

## Task 2 — Thread completo nel dettaglio messaggio

**File da modificare:** `src/components/unibox/MessageDetail.tsx`

Quando un messaggio e' selezionato, caricare tutti i messaggi con lo stesso `thread_id` oppure, se `thread_id` e' null, con lo stesso `da_email`/`da_telefono` + `campaign_id`. Mostrare la lista di messaggi in ordine cronologico nel body, ognuno con timestamp, mittente e badge in/out. Il messaggio corrente sara' evidenziato.

Query: `supabase.from("inbox_messages").select("*").or(...)` filtrato per thread_id o email+campaign, ordinato per `data_ricezione asc`.

Layout del thread: ogni messaggio come un "bubble" con header (nome + timestamp), corpo, e allineamento a sinistra per messaggi ricevuti, a destra per messaggi inviati (distinguibili dal campo `etichetta = 'risposta_inviata'` o confronto `da_email` con i sender dell'utente).

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Settings.tsx` | Aggiungere tab "Ricezione" con guida webhook |
| `src/components/unibox/MessageDetail.tsx` | Aggiungere caricamento e visualizzazione thread |

