

## Piano: Fix Critici Edge Functions — Schema DB

Analizzo i file delle Edge Functions per applicare i fix corretti al schema DB (chiave/valore, contact_id, rimozione n8n_settings).

### File da modificare:

| File | Azione |
|------|--------|
| `supabase/functions/process-sequence/index.ts` | Sovrascrivere con nuova versione |
| `supabase/functions/handle-reply/index.ts` | Fix: `key`→`chiave`, `contatto_id`→`contact_id` |
| `supabase/functions/validate-emails/index.ts` | Fix: `key`→`chiave`, `value`→`valore` |

