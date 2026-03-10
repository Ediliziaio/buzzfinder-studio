

## Assessment: What's Already Built vs. What's Missing

The project already has all 7 pages implemented (Phases 1-6 + Settings), the database schema, design system, auth, sidebar/header layout, and core functionality. The super prompt is a comprehensive spec -- most of it is already done. Here's what's **missing or incomplete**:

### Missing Features (Priority Order)

**1. Campaign Detail Page (Page 5B)**
- No route or page for viewing a single campaign's detailed stats, progress bar, recipient table, and send-over-time chart
- Need: new route `/campaigns/:id`, new page `CampaignDetail.tsx`
- Components: KPI row, progress phases bar, cumulative line chart (Recharts), filterable recipients table

**2. TipTap Rich Text Editor for Email Composer**
- Campaign wizard Step 2A uses a plain `<Textarea>` for HTML body -- the spec requires a TipTap rich text editor with toolbar (B/I/U/Link/H1/H2/List/Image) and template variable insertion ({{nome}}, {{azienda}}, etc.)
- Need: install `@tiptap/react` + extensions, create `EmailEditor.tsx` component, integrate into wizard

**3. Missing Utility Libraries**
- `src/lib/costCalculator.ts` -- detailed cost estimation per channel (Resend tiers, Telnyx per-SMS, Meta per-conversation) as specified in Step 5 of the wizard
- `src/lib/phoneNormalizer.ts` -- normalize Italian numbers to +39 format
- `src/lib/emailValidator.ts` -- basic validation heuristics
- `src/lib/csvParser.ts` -- currently CSV parsing may be inline; should be extracted

**4. Settings Page Gaps**
- "Mittenti" tab is a placeholder ("Verrà implementato con integrazione Resend")
- "Import/Export" tab buttons are non-functional (no actual export logic)
- No n8n status ping/test button
- No "Account" tab mentioned in spec

**5. Export Functionality**
- Contacts page has "ESPORTA" button but no implementation
- Settings Import/Export tab buttons are inert
- Need: CSV export utility with streaming for large datasets

**6. Contacts Page Enhancements**
- "AGGIUNGI" button (manual contact creation) has no handler
- No shift+click range selection in table
- Contact detail drawer missing "Modifica" (edit mode)
- "SALVA COME LISTA" button in filter bar not connected

**7. Campaign Sending via n8n**
- No "Lancia Campagna" flow that actually triggers n8n webhook for email/SMS/WhatsApp sending
- Campaign wizard creates a "bozza" but there's no mechanism to transition to "in_corso" and trigger the send

**8. Cost Calculator Enhancements**
- The wizard review step shows basic cost but not the detailed tier breakdowns shown in the spec (Resend Free/Pro/Business, Telnyx unit costs, Meta conversation pricing)
- Analytics "Proiezione Costi" section with budget tracking is missing

### Implementation Plan (Ordered by Impact)

**Phase A: Campaign Detail Page**
- Add route `/campaigns/:id` in App.tsx
- Create `src/pages/CampaignDetail.tsx` with:
  - Header with campaign name, status, action buttons (Pause/Stop/Replica)
  - 5 KPI cards (Total, Sent, Delivered, Opened, Cost)
  - Phase progress bar (Preparazione → Invio → Completata)
  - Recharts `LineChart` for cumulative sends over time
  - Recipients table (from `campaign_recipients` joined with `contacts`)
- Update `CampaignsList.tsx` to link to detail page

**Phase B: Rich Text Email Editor**
- Install `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`
- Create `src/components/campaigns/EmailEditor.tsx` with toolbar
- Add template variable buttons ({{nome}}, {{azienda}}, {{citta}}, {{sito_web}})
- Add "Preview Email" and "Send Test Email" buttons
- Replace `<Textarea>` in wizard Step 2A

**Phase C: Utility Libraries + Cost Calculator**
- Create `src/lib/costCalculator.ts` with tiered pricing logic per channel
- Create `src/lib/phoneNormalizer.ts` for +39 normalization
- Create `src/lib/emailValidator.ts`
- Enhance `WizardStepReview.tsx` with detailed cost breakdowns per the spec

**Phase D: Export & Missing Actions**
- Create `src/lib/csvExporter.ts` for streaming CSV export
- Wire Contacts page "ESPORTA" button
- Wire Settings Import/Export buttons
- Add manual contact creation dialog
- Wire "SALVA COME LISTA" from contact filters

**Phase E: Settings Completion**
- Implement "Mittenti" tab with sender email CRUD (stored in `app_settings`)
- Add n8n connection test button with ping
- Wire export buttons in Import/Export tab

**Phase F: Campaign Launch Flow**
- Add "Lancia Campagna" action on campaign detail / list
- Transition campaign status to "in_corso"
- Trigger appropriate n8n webhook with recipients payload
- Subscribe to realtime updates for campaign progress

This is a substantial amount of work. I recommend tackling it in the order above (A through F), as each phase builds on the previous and delivers incremental value.

