

# Diagnosi: "Edge Function returned a non-2xx status code"

## Causa probabile

L'errore non e' un bug nel codice. La Edge Function `scrape-maps-page` funziona correttamente (ho verificato che risponde), ma molto probabilmente **manca la Google Maps API Key** nelle impostazioni.

Nel codice della funzione (riga ~110), se non trova la chiave in `app_settings` con `chiave = "google_maps_api_key"`, ritorna un errore 400:

```
"Google Maps API Key non configurata. Vai in Impostazioni → API Keys."
```

Il client Supabase traduce qualsiasi risposta non-2xx in un errore generico "Edge Function returned a non-2xx status code", nascondendo il messaggio originale.

## Due problemi da risolvere

### 1. Mostrare il messaggio di errore reale dalla Edge Function
Attualmente in `runScrapingLoop` (ScraperMaps.tsx), quando `supabase.functions.invoke` ritorna un errore, il codice usa solo `error.message` che e' il messaggio generico del client. Bisogna leggere anche `data?.error` che contiene il messaggio specifico della funzione.

Il codice attuale:
```typescript
if (error) throw new Error(error.message || "Errore Edge Function");
```

Il problema: quando la funzione ritorna un HTTP 400, il client Supabase mette il body nella proprieta' `data` e l'errore generico in `error`. Bisogna controllare entrambi.

### 2. Configurare la Google Maps API Key
L'utente deve andare in Impostazioni e inserire la propria Google Maps API Key.

## Piano di fix

| File | Modifica |
|------|----------|
| `src/pages/ScraperMaps.tsx` | Migliorare il parsing dell'errore in `runScrapingLoop`: leggere `data?.error` quando `error` e' presente, per mostrare il messaggio specifico della funzione |

Modifica minima: nella funzione `runScrapingLoop`, dopo il check `if (error)`, estrarre il messaggio reale dal body della risposta cosi' l'utente vedra' "Google Maps API Key non configurata" invece del generico "Edge Function returned a non-2xx status code".

