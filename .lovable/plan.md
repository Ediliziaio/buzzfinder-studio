

# Plan: AI Agents Integration for BuzzFinder Studio

## Summary
Add a new "Agenti AI" tab in Settings with three agent setup panels (Claude Cowork, Kimi 2.5, OpenClaw), a multi-model AI selector, and backend support for switching between Lovable AI, Anthropic, and Moonshot providers.

## Architecture Decisions

- **Kimi batch analysis must go through an edge function** (never expose API keys from frontend). We'll create a `kimi-batch-analysis` edge function.
- **Multi-model support in edge functions**: Add a `callAI` helper that reads `ai_model_attivo` from `app_settings` and routes to the correct provider (Lovable AI gateway as default, Anthropic, or Moonshot).
- **`personalize-messages` edge function** needs to be created (currently missing but referenced in frontend).
- The existing `handle-reply` uses Lovable AI — we'll extend it to support the selected model while keeping Lovable AI as fallback.

## Implementation Steps

### 1. New Settings Components (4 files)

| File | Purpose |
|------|---------|
| `src/components/settings/AIModelSelector.tsx` | Card grid to select active AI model (Lovable AI models + Claude Haiku/Sonnet + Kimi variants). Saves to `app_settings.ai_model_attivo` |
| `src/components/settings/ClaudeCoworkSetup.tsx` | Anthropic API key field + copiable skill config for Claude desktop agent (REST API endpoints, table schema, pipeline stages) |
| `src/components/settings/KimiSetup.tsx` | Kimi API key field + connection test button + "Analisi Batch" button that calls the new edge function |
| `src/components/settings/OpenClawSetup.tsx` | Copiable JS skill code + WhatsApp/Gmail relay code + webhook URLs. Uses `SettingField` for any config |

### 2. Update Settings Page
- Add `"agenti"` tab to `TabsList`
- Import and render the 4 new components in the tab content
- Keep existing "AI" tab for budget/cost settings

### 3. New Edge Function: `kimi-batch-analysis`
- Reads `kimi_api_key` from `app_settings`
- Loads inbox messages from last 90 days
- Calls Moonshot API server-side
- Returns analysis text
- `verify_jwt = true` (authenticated users only)

### 4. New Edge Function: `personalize-messages`
- Reads `ai_model_attivo` from `app_settings`
- Routes to Lovable AI gateway (default), Anthropic API, or Moonshot API based on model
- Processes campaign recipients in batches
- Updates `messaggio_personalizzato` and `soggetto_personalizzato`
- `verify_jwt = true`

### 5. Update `handle-reply` Edge Function
- Add multi-model `callAI` helper
- Read `ai_model_attivo` from `app_settings`
- If model starts with `moonshot-` → use Kimi API (read `kimi_api_key`)
- If model starts with `claude-` → use Anthropic API (read `anthropic_api_key`)
- Default → keep current Lovable AI gateway behavior
- Graceful fallback: if selected model key missing, fall back to Lovable AI

### 6. Update `supabase/config.toml`
- Add `kimi-batch-analysis` and `personalize-messages` function entries

### 7. No DB migration needed
- `app_settings` already supports arbitrary key-value pairs
- New keys (`ai_model_attivo`, `kimi_api_key`) are inserted via the UI's `SettingField` upsert pattern

## Security Notes
- API keys for Anthropic/Kimi are stored in `app_settings` (per-user, RLS protected)
- Kimi batch analysis runs server-side only — no API keys exposed in frontend
- OpenClaw config displays the publishable anon key (this is safe by design — it's a public key)
- `handle-reply` remains `verify_jwt = false` (public webhook)

