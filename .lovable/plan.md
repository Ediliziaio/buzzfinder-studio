

# Piano: Cron Job pg_cron per process-automations

## Stato attuale
Il bottone "Processa coda" esiste già nella pagina Automazioni ed è funzionante. Manca solo il cron job automatico.

## Cosa farò

### 1. Abilitare le estensioni `pg_cron` e `pg_net`
Creerò una migrazione SQL per abilitare entrambe le estensioni necessarie per invocare Edge Functions su schedule.

### 2. Creare il cron job
Eseguirò una query SQL (non migrazione, contiene dati specifici del progetto) per schedulare `process-automations` ogni 5 minuti:

```sql
SELECT cron.schedule(
  'process-automations-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tiqzzhycqmspdpzqcbdo.supabase.co/functions/v1/process-automations',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb,
    body := '{"batch_size": 50}'::jsonb
  ) AS request_id;
  $$
);
```

Questo invocherà automaticamente la Edge Function ogni 5 minuti con l'anon key. La funzione processerà tutte le automazioni pending in coda.

### Note tecniche
- Il cron job usa l'anon key (non service_role), quindi la Edge Function processerà solo le esecuzioni accessibili
- La funzione `process-automations` ha già `verify_jwt = false` nel config.toml, quindi l'anon key funziona come bearer token senza problemi
- Il bottone manuale resta disponibile per processamento immediato

