

# Piano: Bottone Salva + Validazione API Keys in Impostazioni

## Situazione attuale
- I `SettingField` salvano automaticamente su blur (onBlur) — non c'e' un bottone "Salva" esplicito
- Nessuna validazione delle API key inserite

## Modifiche

### 1. Bottone "Salva tutte le impostazioni" nell'header della pagina Settings
Aggiungere un bottone "Salva" nell'header accanto al titolo "IMPOSTAZIONI". Al click:
- Raccoglie tutti i valori correnti dei SettingField
- Li salva in batch su `app_settings`
- Mostra toast di conferma

**Approccio**: Modificare `SettingField` per esporre il valore corrente tramite un ref/callback pattern, oppure (piu' semplice) mantenere il salvataggio su blur ma aggiungere un bottone "Salva" che triggera il salvataggio di tutti i campi visibili. Il modo piu' pulito: usare un **context** `SettingsFormContext` che raccoglie tutti i campi registrati e il bottone Salva li flusha tutti.

### 2. Validazione API Keys
Aggiungere una funzione `validateApiKey` che testa le API key principali al salvataggio. Per ogni provider:

| Provider | Endpoint di test | Check |
|----------|-----------------|-------|
| Resend | `POST https://api.resend.com/emails` con body vuoto → 422 = key valida, 401 = invalida | status !== 401 |
| Google Maps | `GET https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=KEY` | `status !== "REQUEST_DENIED"` |
| ScrapingBee | `GET https://app.scrapingbee.com/api/v1/usage?api_key=KEY` | status 200 |
| ElevenLabs | Gia' implementato (`ElevenLabsTestButton`) |
| Anthropic | Non testabile da browser (CORS) — skip |

Al salvataggio, se una key e' stata modificata e il provider supporta la validazione, testare e mostrare errore specifico con toast rosso se invalida.

### 3. Indicatore stato validazione nel SettingField
Aggiungere un prop opzionale `validator` al `SettingField`. Dopo il salvataggio, se il validator e' presente, viene chiamato. Se fallisce, mostra icona ❌ rossa e toast di errore.

## File coinvolti

| File | Modifiche |
|------|-----------|
| `src/pages/Settings.tsx` | Aggiungere bottone "Salva" nell'header, logica salvataggio batch, definizione validatori per le key principali |
| `src/components/settings/SettingField.tsx` | Aggiungere prop `validator?: (val: string) => Promise<string | null>`, stato `error`, icona errore, chiamata validator dopo save |

