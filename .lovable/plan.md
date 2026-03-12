

# Piano: Sicurezza CORS + Auth in scrape-website + Robustezza n8n

## 1. `supabase/functions/scrape-website/index.ts`

### CORS dinamico
- Sostituire `"*"` con whitelist basata su `ALLOWED_ORIGINS` env var, fallback a URL del progetto Supabase
- L'header `Access-Control-Allow-Origin` viene impostato dinamicamente controllando l'header `Origin` della request contro la whitelist

### Autenticazione JWT
- Estrarre il token dall'header `Authorization: Bearer ...`
- Usare `supabase.auth.getUser(token)` per verificare l'utente
- Confrontare `user.id` con `session.user_id` per garantire ownership
- Ritornare 401/403 se non autenticato o non autorizzato

### X-Request-ID
- Generare `crypto.randomUUID()` e includerlo in tutte le risposte come header

## 2. `src/services/n8n.ts`

### Timeout 10s
- Aggiungere `timeout: 10000` alla config axios in `triggerN8nWebhook`

### Retry con backoff esponenziale
- Max 3 tentativi, delay = 1s, 2s, 4s
- Retry solo su errori di rete o 5xx (non su 4xx)

### X-Request-ID
- Generare UUID con `crypto.randomUUID()` e aggiungerlo come header a tutte le richieste axios e fetch

## File coinvolti

| File | Modifiche |
|------|-----------|
| `supabase/functions/scrape-website/index.ts` | CORS dinamico, verifica JWT + ownership, X-Request-ID |
| `src/services/n8n.ts` | Timeout 10s, retry con backoff, X-Request-ID |

