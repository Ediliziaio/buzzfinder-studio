

# Phase 4: Settings + Wizard + Integrations

## Overview
Add ElevenLabs settings tab, update CampaignWizard with "chiamata" channel support, enhance CampaignDetail with call stats widget, and add backup table coverage.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Settings.tsx` | Add "AI & Chiamate" tab with 3 sections (Anthropic, ElevenLabs, Call settings) + ElevenLabs test button. Add "call_sessions", "automation_rules", "automation_executions" to backup tables array. |
| `src/components/campaigns/CampaignWizard.tsx` | Add "chiamata" to CANALI array. In sequence step builder, when tipo='chiamata' show agent select + obiettivo/script fields. Save `elevenlabs_agent_id`, `chiamata_script`, `chiamata_obiettivo` on campaign_steps insert. |
| `src/pages/CampaignDetail.tsx` | Add call stats mini-widget below KPIs querying `call_sessions` for campaign. Show count completed/interessati/appuntamenti with link to `/calls?campaign_id=X`. |
| `src/components/layout/AppSidebar.tsx` | Already has Chiamate AI + Automazioni links — verify they're present (they are from Phase 3). No changes needed. |

## Implementation Details

### Settings.tsx — "AI & Chiamate" tab
- New tab `ai_calls` after "Agenti AI"
- **Section 1 "ANTHROPIC"**: SettingField for `anthropic_api_key` (isSecret) + Select for `ai_model_attivo` with claude-haiku/sonnet/moonshot options
- **Section 2 "ELEVENLABS"**: SettingFields for `elevenlabs_api_key` (isSecret), `elevenlabs_agent_id_default`, `elevenlabs_phone_number_id`. Link to ElevenLabs dashboard. "TEST CONNESSIONE" button that fetches `https://api.elevenlabs.io/v1/user` with xi-api-key header via a local fetch (CORS may be an issue — use edge function proxy or try direct)
- **Section 3 "IMPOSTAZIONI CHIAMATE"**: SettingFields for orario inizio/fine, max tentativi, intervallo. SettingToggle for solo_lavorativi
- Add 3 tables to backup array: `call_sessions`, `automation_rules`, `automation_executions`

### CampaignWizard.tsx — Chiamata channel
- Add `{ value: "chiamata", label: "Chiamata AI", icon: Phone, desc: "Chiamata AI ElevenLabs", costPer: 0.10 }` to CANALI
- In SequenceBuilder step cards, when tipo='chiamata': show Textarea for `chiamata_obiettivo` and `chiamata_script`, plus optional `elevenlabs_agent_id` input
- Already saves steps with these fields — just need the UI to expose them

### CampaignDetail.tsx — Call stats widget
- After KPI cards, query `call_sessions` where `campaign_id = campaign.id` with count + filters for esito
- Display mini-card: "📞 CHIAMATE AI: Effettuate: N | Interessati: N (%) | Appuntamenti: N" with link to `/calls`
- Only show if campaign has any call_sessions

### ElevenLabs test — approach
The test connection button will read the API key from app_settings, then use `supabase.functions.invoke` to a small edge function or do a direct fetch. Since ElevenLabs API likely has CORS restrictions, we'll create a tiny proxy via an existing pattern — actually, we can attempt the direct fetch first since the ElevenLabs API may allow it. If not, fall back to reading the key and showing instructions.

Alternative: read the key from state (it's already in the SettingField), pass it to a quick edge function call. Simpler: just do a direct `fetch` from the browser — ElevenLabs API does support CORS for GET /v1/user.

