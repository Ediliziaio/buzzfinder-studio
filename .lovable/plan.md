

# Analisi: Pagina Settings gia' completa

## Stato attuale

Tutti i campi richiesti nella Fase 6 **esistono gia'**:

| Campo richiesto | Stato |
|----------------|-------|
| `anthropic_api_key` | Presente (riga 92) |
| `millionverifier_api_key` | Presente (riga 95) |
| `zerobounce_api_key` | Presente (riga 96) |
| Webhook WhatsApp/SMS/Email | Presenti come `n8n_webhook_send_*` (righe 128-130) |
| Tab Ricezione con URL endpoint + guida | Presente via `WebhookGuideTab` (righe 211-213) con URL copiabile, guida Resend, n8n+IMAP, webhook manuale |
| Tab AI con modello + costi stimati | Presente (righe 190-208) |
| Timezone + orari default | Presenti nel tab Orari (righe 142-148) |

## Unica aggiunta utile

Il campo `resend_inbound_secret` (signing secret per verificare richieste Resend inbound) non e' presente nel tab Ricezione. Questo e' l'unico campo mancante rispetto alla Fase 6.

## Piano

| File | Modifica |
|------|----------|
| `src/components/settings/WebhookGuideTab.tsx` | Aggiungere un `SettingField` per `resend_inbound_secret` in fondo alla sezione Resend Inbound |

Aggiunta minima: un campo password per il signing secret Resend nella sotto-tab "Resend Inbound" del `WebhookGuideTab`, dopo lo step 5.

