

# Piano: Migration Database — Solo Elementi Mancanti

## Analisi dello stato attuale

Ho verificato il database e la maggior parte delle tabelle citate nelle 6 migrazioni **esiste gia'**:
- `sender_pool`, `campaign_steps`, `campaign_step_executions`, `inbox_messages`, `blacklist_checks`, `campaign_templates`, `suppression_list`, etc.

Tuttavia mancano diversi elementi. Ecco cosa va aggiunto con una **singola migration consolidata**:

### Tabelle mancanti
| Tabella | Note |
|---------|------|
| `sender_daily_stats` | Stats giornaliere per sender, FK su `sender_pool` esistente |
| `email_events` | Open/click/bounce tracking, FK su `campaign_step_executions` |
| `unsubscribes` | Disiscritti con vincoli unique su email/telefono |

### Colonne mancanti su tabelle esistenti
| Tabella | Colonne da aggiungere |
|---------|----------------------|
| `campaign_recipients` | `pipeline_stage`, `pipeline_note`, `pipeline_updated`, `risposta_at` |
| `contacts` | `ai_intro`, `ai_personalizzato_at`, `ai_modello`, `email_validato`, `email_validato_at` |
| `scraping_sessions` | `pausa_motivo` |
| `campaigns` | `stop_su_disiscrizione`, `tracking_click`, `custom_tracking_domain` |

### Funzioni/Trigger mancanti
- `increment_step_stat` (RPC per aggiornare stats step)
- `calculate_health_score` (calcolo health sender)
- `update_health_score` (trigger su sender_pool)
- `sync_risposta_at` (trigger su campaign_step_executions)

### View mancante
- `campaign_analytics` (vista aggregata performance campagne)

### Dati mancanti
- Righe default in `app_settings` (webhook URLs, API keys) — nota: la tabella ha RLS con `user_id = auth.uid()`, quindi i valori di default senza `user_id` vanno inseriti **senza** RLS (la migration gira come superuser)

## Cosa NON va toccato
- Le tabelle `sender_pool`, `campaign_steps`, `campaign_step_executions`, `inbox_messages`, `blacklist_checks`, `campaign_templates` esistono gia' con lo schema corretto
- Le colonne `paused_at`/`resumed_at` su `scraping_sessions` esistono gia'
- Le colonne AI su `campaigns` esistono gia'
- La colonna `sender_id` su `campaign_recipients` esiste gia'
- La pubblicazione Realtime su `inbox_messages` e' gia' attiva

## Implementazione
Una singola migration SQL consolidata tramite il tool di migrazione che aggiunge solo gli elementi mancanti verificati sopra.

