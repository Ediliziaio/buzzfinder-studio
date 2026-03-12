

# ElevenLabs AI Calls + Automation Rules Engine — Phase 1

## Overview
Add the database schema for AI-powered phone calls (ElevenLabs) and a "if...then" automation rules engine, plus corresponding TypeScript types.

## What will be done

### 1. Database Migration
Run the provided SQL migration to create:
- **`call_sessions`** table — one row per AI phone call, with transcription, sentiment, outcome, cost
- **`automation_rules`** table — "IF trigger THEN action" rules engine
- **`automation_executions`** table — execution log for automation rules
- **`call_analytics`** view — aggregated call metrics per campaign
- New columns on `sender_pool` (elevenlabs fields, chiamate_oggi, etc.)
- New columns on `campaign_steps` (elevenlabs_agent_id, chiamata_script, etc.)
- New columns on `contacts` (telefono_chiamabile, telefono_dnc, ultima_chiamata_at, etc.)
- New entries in `app_settings` for ElevenLabs config keys
- RLS policies, indexes, and realtime subscriptions

**Note on RLS**: The provided migration uses permissive `USING (true)` policies for authenticated users. This is acceptable for Phase 1 but should be tightened to user-scoped policies later. The `app_settings` INSERT needs `user_id` — since these are global defaults, I'll adjust the INSERT to omit `user_id` (nullable column) so it doesn't conflict with existing RLS. Actually, looking at the RLS on `app_settings` (`user_id = auth.uid()`), rows without `user_id` won't be readable. I'll note this but proceed as specified — these seed values serve as documentation; actual values will be set per-user via the Settings UI.

**Migration adjustment**: The `ON CONFLICT (chiave)` clause won't work because `app_settings` has a unique constraint on `(chiave, user_id)`, not just `chiave`. I'll change to `ON CONFLICT DO NOTHING` or remove the seed inserts entirely since users configure these via Settings UI.

### 2. TypeScript Types (`src/types/index.ts`)
Add to the file:
- `CallStato`, `CallEsito` union types
- `CallSession` interface
- `AutomationTrigger`, `AutomationAzione` union types
- `AutomationRule` interface with typed `condizioni` array
- `AutomationExecution` interface
- Extend `Contact` with 5 new call-related fields
- Extend `SettingCategoria` with `'elevenlabs'` | `'chiamate'` | `'notifiche'`
- Add `'chiamata'` to `ActivityTipo`

### 3. Files Changed
| File | Change |
|------|--------|
| Database (migration tool) | Full SQL migration |
| `src/types/index.ts` | New types + extended interfaces |

No frontend UI changes in this phase — this is schema-only.

