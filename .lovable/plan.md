

# Phase 2: ElevenLabs Edge Functions

## Overview
Create 3 new edge functions for AI-powered phone calls and automation processing, plus update config.toml.

## Important Notes

### Missing Secret: ELEVENLABS_API_KEY
The project does not have an `ELEVENLABS_API_KEY` secret configured. However, the provided code reads it from `app_settings` (user-scoped DB rows), not from Deno env. So no secret needs to be added now — the API key is stored per-user in the database via Settings UI.

### Code Adjustments Needed
The provided code has a few issues I'll fix during implementation:

1. **`make-call`**: Uses `Deno.serve()` (correct) but also references `contact.telefono_dnc` and `contact.totale_chiamate` which aren't in the `.select()` — I'll add them.
2. **`make-call`**: References `contact.categoria` but the DB column doesn't exist on contacts. I'll use `google_categories` instead.
3. **`call-webhook`**: The `inbox_messages` insert is missing `user_id` (required NOT NULL column). I'll look up the user_id from the call_session or contact.
4. **`call-webhook`**: The `automation_executions` insert is missing `user_id` (required NOT NULL column). Same fix.
5. **`process-automations`**: The `make-call` function has `verify_jwt = true`, so calling it from `process-automations` with service_role key should work since the edge function guidelines say to set `verify_jwt = false` and validate in code. However, the user explicitly wants `verify_jwt = true` for `make-call`. The service_role key will bypass JWT verification, so this is fine.
6. **CORS headers**: I'll use the full set of allowed headers per project conventions.

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/make-call/index.ts` | Create |
| `supabase/functions/call-webhook/index.ts` | Create |
| `supabase/functions/process-automations/index.ts` | Create |
| `supabase/config.toml` | Add 3 new function configs |

## Implementation Details

### Edge Function 1: `make-call`
- Accepts `contact_id`, optional `campaign_id`, `agent_id`, `scheduled_at`, etc.
- Reads `elevenlabs_api_key` and agent config from `app_settings`
- Validates contact has phone, not DNC, within allowed hours
- Creates `call_sessions` row, calls ElevenLabs outbound API
- Updates contact stats

### Edge Function 2: `call-webhook`
- Public endpoint (`verify_jwt = false`) for ElevenLabs callbacks
- Receives transcription, duration, status
- Uses Claude (via `anthropic_api_key` from `app_settings`) to classify call outcome
- Updates `call_sessions`, `contacts`, `campaign_recipients`, creates `inbox_messages`
- Triggers automation rules for `chiamata_completata` / `chiamata_esito`
- Fix: resolve `user_id` from contact record for `inbox_messages` and `automation_executions` inserts

### Edge Function 3: `process-automations`
- Processes pending `automation_executions` in batches
- Supports actions: `chiama_contatto`, `cambia_pipeline_stage`, `assegna_tag`, `notifica_webhook`, `notifica_slack`
- Calls `make-call` internally for phone call actions
- Updates execution status and rule counters

### Config
Append 3 entries to `config.toml` with correct `verify_jwt` settings.

