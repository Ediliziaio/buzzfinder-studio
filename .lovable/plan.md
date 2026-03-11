

# Piano: Risposta Inline dalla Unibox

## Cosa costruire

Un compositore di risposta inline nel dettaglio messaggio che permette di rispondere via email o WhatsApp direttamente dalla Unibox. Il messaggio viene inviato tramite una nuova Edge Function `send-reply` che usa le credenziali dal `sender_pool`.

## Architettura

```text
[Utente compone risposta in Unibox]
         ↓
[POST supabase.functions.invoke("send-reply")]
         ↓
[Edge Function: legge sender_pool per credenziali]
         ↓
[Resend API (email) / Meta Cloud API (WhatsApp)]
         ↓
[Salva risposta in inbox_messages come messaggio in uscita]
```

## Componenti da creare/modificare

### 1. Nuovo componente `ReplyComposer.tsx`
- Textarea per il corpo della risposta
- Per email: campo oggetto pre-compilato con `Re: {oggetto originale}`
- Per WhatsApp: solo textarea (no oggetto)
- Bottone "Invia" con loading state
- Toggle per mostrare/nascondere il composer
- Bottone "Rispondi" nella toolbar del MessageDetail per aprire il composer

### 2. Nuova Edge Function `send-reply`
- Riceve: `message_id`, `canale`, `destinatario` (email o telefono), `oggetto`, `corpo`, `corpo_html`
- Cerca nel `sender_pool` un mittente attivo per il canale corretto (owned by user)
- Email: usa `resend_api_key` + `email_from` dal sender per inviare via Resend API
- WhatsApp: usa `wa_access_token` + `wa_phone_number_id` per inviare via Meta API
- Salva la risposta inviata come nuovo record in `inbox_messages` con un flag per distinguere messaggi in uscita (canale rimane lo stesso, `da_email`/`da_nome` sarà il mittente)
- Richiede JWT (autenticato)

### 3. Modifica `MessageDetail.tsx`
- Aggiungere bottone "Rispondi" nella toolbar (icona Reply)
- Mostrare il `ReplyComposer` sotto il corpo del messaggio quando attivo
- Il composer si chiude dopo invio riuscito

### 4. Modifica `src/types/index.ts`
- Nessuna modifica necessaria, `InboxMessage` copre già tutti i campi

## Dettagli tecnici

- L'Edge Function `send-reply` deve avere `verify_jwt = false` nel config.toml e validare il JWT manualmente nel codice
- Per Resend: `POST https://api.resend.com/emails` con la `resend_api_key` del sender
- Per WhatsApp: `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` con il `wa_access_token`
- Il messaggio inviato viene salvato in `inbox_messages` con `user_id` dell'utente, stesso `campaign_id`/`recipient_id`/`thread_id` del messaggio originale, e `etichetta = 'risposta_inviata'` (o un campo custom per distinguere in/out)

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/send-reply/index.ts` | Creare |
| `src/components/unibox/ReplyComposer.tsx` | Creare |
| `src/components/unibox/MessageDetail.tsx` | Aggiungere bottone Rispondi + integrazione composer |

