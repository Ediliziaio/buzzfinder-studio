

# Analytics Avanzate + CRM Pipeline

## Current State

- **Analytics page** already exists at `/analytics` with basic KPIs, area/bar/pie charts, cost projection, and campaign performance. It uses `useAnalytics` hook that fetches contacts, campaigns, usage_log, and scraping_sessions.
- **No Pipeline/CRM page** exists. No `pipeline_stage` columns on any table. No `/pipeline` route.
- **No `pipeline_leads` table** or pipeline-related columns on contacts/inbox_messages.
- Sidebar already has Analytics entry. No Pipeline entry.

## Plan

### 1. Database Migration

Add `pipeline_leads` table for CRM pipeline tracking:
- `id uuid PK`, `user_id uuid`, `contact_id uuid`, `campaign_id uuid`, `inbox_message_id uuid`
- `pipeline_stage text DEFAULT 'interessato'` (interessato, richiesta_info, meeting_fissato, proposta_inviata, vinto, perso)
- `pipeline_note text`, `valore_stimato numeric DEFAULT 0`
- `pipeline_updated timestamptz DEFAULT now()`, `created_at timestamptz DEFAULT now()`
- RLS: `user_id = auth.uid()`

### 2. Enhanced Analytics Page (`src/pages/Analytics.tsx`)

Complete rewrite with:
- **Period filter** (7/14/30/90 days) — currently missing
- **Enhanced KPI row**: add Risposte and Interessati counts (from inbox_messages)
- **FunnelChart component**: horizontal bar funnel (Inviati → Aperti → Cliccati → Risposte → Interessati)
- **TimelineChart component**: daily line chart for inviati/aperti/risposte using recharts (already available)
- **CampaignPerformanceTable**: sortable table with open%, reply%, bounce%, stato per campaign
- **SendingHeatmap**: day-of-week × hour heatmap from campaign_recipients.inviato_at
- Keep existing cost projection section

### 3. Enhanced `useAnalytics` hook

Add period filter parameter, add risposte/interessati counts from inbox_messages, add per-campaign detail data, add daily timeline data for inviati/aperti.

### 4. New Analytics Components

| File | Purpose |
|------|---------|
| `src/components/analytics/FunnelChart.tsx` | Horizontal bar funnel visualization |
| `src/components/analytics/TimelineChart.tsx` | Daily line chart with recharts |
| `src/components/analytics/CampaignPerformanceTable.tsx` | Sortable campaign stats table |
| `src/components/analytics/SendingHeatmap.tsx` | Day×hour grid heatmap |

### 5. Pipeline Page (`src/pages/Pipeline.tsx`)

Kanban board with 6 columns (Interessati, Richiesta Info, Meeting, Proposta, Vinti, Persi). Each column shows LeadCards with contact info, campaign name, notes, and stage-move buttons. No drag-and-drop (keeps it simple).

### 6. Pipeline Components

| File | Purpose |
|------|---------|
| `src/components/pipeline/KanbanColumn.tsx` | Single column with lead cards |
| `src/components/pipeline/LeadCard.tsx` | Card with contact info, notes, move actions |
| `src/hooks/usePipeline.ts` | CRUD for pipeline_leads with realtime |

### 7. A/B Test Results in CampaignDetail

Add `ABTestResults` component showing variant comparison when campaign has A/B steps. Display open rate and reply rate per variant with winner badge.

| File | Purpose |
|------|---------|
| `src/components/campaigns/ABTestResults.tsx` | A/B variant comparison cards |

### 8. Routing & Navigation

- Add `/pipeline` route in `App.tsx`
- Add "Pipeline" nav item in `AppSidebar.tsx` (Trophy icon) between Analytics and Impostazioni
- Add types for `PipelineLead` in `src/types/index.ts`

### 9. Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create `pipeline_leads` table |
| `src/pages/Analytics.tsx` | Rewrite with period filter, funnel, timeline, heatmap |
| `src/hooks/useAnalytics.ts` | Add period param, risposte, interessati, timeline data |
| `src/components/analytics/FunnelChart.tsx` | Create |
| `src/components/analytics/TimelineChart.tsx` | Create |
| `src/components/analytics/CampaignPerformanceTable.tsx` | Create |
| `src/components/analytics/SendingHeatmap.tsx` | Create |
| `src/pages/Pipeline.tsx` | Create Kanban page |
| `src/components/pipeline/KanbanColumn.tsx` | Create |
| `src/components/pipeline/LeadCard.tsx` | Create |
| `src/hooks/usePipeline.ts` | Create |
| `src/components/campaigns/ABTestResults.tsx` | Create |
| `src/types/index.ts` | Add PipelineLead type |
| `src/App.tsx` | Add /pipeline route |
| `src/components/layout/AppSidebar.tsx` | Add Pipeline nav item |
| `src/pages/CampaignDetail.tsx` | Add ABTestResults section |

