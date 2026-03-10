

## Gap Analysis: LeadHunter Pro — Remaining Work

After reviewing the full codebase, the application is ~85% complete. Here are the remaining gaps against the spec, organized by priority:

### 1. Contact Detail Drawer — Activity Timeline (missing)
The drawer shows a placeholder "Importato da..." text. Need to fetch `contact_activities` and render a proper timeline with campaign references, status changes, and import events.

### 2. Analytics — Cost Projection Section (missing)
The spec requires a "PROIEZIONE COSTI MESE CORRENTE" section with: days elapsed, projected end-of-month cost, budget remaining bar, and breakdown by channel. Currently absent from Analytics page.

### 3. Contact Filters — "SALVA COME LISTA" Button (not wired)
The filter bar has no "Save as List" button. When filters are active, users should be able to save current filter criteria as a new dynamic list directly.

### 4. Contacts Table — Edit Mode in Drawer (missing)
The drawer shows data read-only with a Save button for notes/status only. No inline editing of contact fields (nome, email, telefono, etc.).

### 5. Settings — Alert Soglie Costi (missing)
The Limiti tab has budget_mensile but no per-channel cost alert thresholds (Email €/month, SMS €/month, WA €/month) as specified.

### 6. Settings — Export Activity Log & Backup JSON (missing)
Import/Export tab only has contacts CSV and campaign report exports. Missing: activity log export and full database JSON backup.

### 7. Campaign Wizard — "Preview Email" and "Send Test Email" Buttons (missing)
The email composer step has TipTap editor but no preview modal or test email send functionality.

---

### Implementation Plan

**Phase 1: Contact Activity Timeline**
- Update `ContactDetailDrawer.tsx` to fetch from `contact_activities` where `contact_id` matches
- Render timeline with icons per activity type, relative dates, and campaign name references
- Add loading state

**Phase 2: Analytics Cost Projection**
- Add `useAnalytics` data for current month costs by channel (from `usage_log`)
- Add budget from `app_settings` (key: `budget_mensile`)
- Render projection card: days elapsed/total, projected cost, progress bar, channel breakdown

**Phase 3: Save Filters as List**
- Add "SALVA COME LISTA" button in `ContactFiltersBar` when filters are active
- On click, create a new `lists` row with `tipo: 'dinamica'` and current filters as `filtri` JSON
- Show name input dialog before saving

**Phase 4: Contact Edit Mode**
- Add edit toggle in `ContactDetailDrawer`
- When editing, render Input fields for key contact data (nome, cognome, azienda, email, telefono, sito_web, indirizzo, citta)
- Save all changed fields on confirm

**Phase 5: Settings Enhancements**
- Add cost alert threshold fields to Limiti tab (alert_email_eur, alert_sms_eur, alert_whatsapp_eur)
- Add activity log export and JSON backup buttons to Import/Export tab
- Wire export functions in `csvExporter.ts`

**Phase 6: Email Preview & Test Send**
- Add "Preview Email" button in wizard Step 2A that opens a modal rendering the HTML with sample variable replacements
- Add "Send Test Email" button that sends via a backend function to a specified address

All changes are frontend-only or use existing database tables. No schema migrations needed.

