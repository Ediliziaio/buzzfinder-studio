

# Part 3 + Part 4: Rebuild Settings & Create Dashboard

## Part 3 — Rebuild Settings Page

Restructure `src/pages/Settings.tsx` with 5 tabs per the prompt spec:

### New tab structure:
1. **API Keys** — Resend, Anthropic, MillionVerifier, ZeroBounce, Google Maps, ScrapingBee, Meta WhatsApp, Telnyx
2. **Webhook n8n** — n8n URL, API key, all webhook paths + test connection button + payload docs
3. **Orari Invio** — Default timezone, ora inizio/fine, solo lavorativi toggle, sending limits, budget
4. **Tracking** — Tracking aperture/click toggles, custom tracking domain, GDPR note
5. **AI** — AI model select (Haiku/Sonnet), budget max AI per campagna, cost estimator, Anthropic key reference

### Helper components to create:
- `src/components/settings/SettingField.tsx` — Individual field that loads/saves from `app_settings` independently
- `src/components/settings/SettingToggle.tsx` — Boolean toggle that loads/saves from `app_settings`

### What stays:
- Import/Export functionality moves into a section within Settings or stays as a sub-tab
- The save-per-field pattern (each field saves independently via upsert)

## Part 4 — Create Dashboard Page

Replace `src/pages/Index.tsx` (currently just a redirect) with a real dashboard.

### Content:
1. **4 KPI Cards** (grid): Campagne Attive, Email Inviate (30gg), Messaggi Non Letti, Open Rate Medio
2. **Campagne Recenti** table: last 5 campaigns with nome, tipo, stato badge, inviati, open rate, link
3. **Quick Actions**: Nuova Campagna, Importa Contatti, Vai all'Unibox

### Data sources:
- `useCampaigns()` for campaign stats
- `useAnalytics()` for email/open rate totals
- Query `inbox_messages` for unread count
- Reuse `KpiCard` component

### Route change:
- Update `src/App.tsx`: change `<Route path="/" element={<Navigate to="/contacts" />} />` to render `<IndexPage />`

## Files

| File | Action |
|------|--------|
| `src/components/settings/SettingField.tsx` | Create — individual auto-save setting input |
| `src/components/settings/SettingToggle.tsx` | Create — individual auto-save toggle |
| `src/pages/Settings.tsx` | Rewrite — 5 tabs with new structure |
| `src/pages/Index.tsx` | Rewrite — real dashboard with KPIs |
| `src/App.tsx` | Update — render Index page instead of redirect |

