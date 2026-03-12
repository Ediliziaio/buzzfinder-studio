

# Phase 3: UI Pages — Calls Dashboard + Automations

## Overview
Create 2 new pages (`Calls.tsx` and `Automations.tsx`), add routes in `App.tsx`, and add nav items in `AppSidebar.tsx`.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/Calls.tsx` | Create — full Calls AI dashboard |
| `src/pages/Automations.tsx` | Create — automation rules manager |
| `src/App.tsx` | Add imports + 2 routes |
| `src/components/layout/AppSidebar.tsx` | Add "Chiamate AI" + "Automazioni" to outreach group |

## Implementation Details

### 1. `src/pages/Calls.tsx`
- 3 tabs: Live, Storico, Analytics
- KPI bar: totale oggi, completate, interessati, costo
- **Live tab**: realtime subscription on `call_sessions` for `calling`/`scheduled` states, live duration timer with `setInterval`
- **Storico tab**: filtered table with stato/esito/period filters, click-to-open detail dialog
- **Analytics tab**: recharts bar chart (calls per day, last 7 days), KPI cards
- **Detail dialog**: shows transcript (formatted agent/lead), AI summary, notes, recording button, "Richiama" button
- **New call dialog**: contact search (debounce 300ms), agent select from `sender_pool` tipo=chiamata, obiettivo/contesto textareas, schedule toggle with date picker, calls `make-call` edge function
- Esito badges: interessato=green, appuntamento=purple, richiama=yellow, non_interessato=gray, da_analizzare=blue
- Sentiment emojis: 😊/😐/😞
- All queries use `supabase` client with proper `.select()` joining contacts

### 2. `src/pages/Automations.tsx`
- 2 tabs: Regole attive, Log esecuzioni
- **Rules tab**: card-based layout showing trigger→action flow, switch toggle, edit/delete/run buttons
- **Log tab**: table with date, rule name, contact, stato badge, trigger context, error tooltip
- **Create/Edit dialog**: 3-step wizard
  - Step 1: trigger type grid (9 options as clickable cards), conditional params below
  - Step 2: action type grid (6 options), action-specific params
  - Step 3: name, description, campaign select, max executions, cooldown, preview
- **Templates**: 5 pre-built templates shown when no rules exist, one-click to pre-fill the creation dialog
- CRUD operations directly on `automation_rules` table
- Manual execution: inserts into `automation_executions` with stato='pending', then calls `process-automations` edge function

### 3. `App.tsx` Changes
- Add imports for `Calls` and `Automations`
- Add 2 routes inside the `RequireAuth` block: `/calls` and `/automations`

### 4. `AppSidebar.tsx` Changes
- Import `Phone` and `Zap` from lucide-react
- Add to "outreach" group after "Unibox":
  - `{ title: "Chiamate AI", path: "/calls", icon: Phone }`
  - `{ title: "Automazioni", path: "/automations", icon: Zap }`

### Key Patterns Followed
- `sonner` for toasts
- `supabase` from `@/integrations/supabase/client`
- Types from `@/types`
- font-mono terminal dark theme style matching existing pages
- `.maybeSingle()` for potentially missing records
- Supabase Realtime channel subscription with cleanup

