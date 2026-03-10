

# Multi-Campaign Management

## 1. Database Migration

Create `campaign_templates` table with RLS policy scoped to `user_id`:

```sql
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  subject TEXT, body_html TEXT, body_text TEXT,
  template_whatsapp_id TEXT, template_whatsapp_language TEXT DEFAULT 'it',
  template_whatsapp_variables JSONB DEFAULT '[]',
  sender_email TEXT, sender_name TEXT, reply_to TEXT,
  sending_rate_per_hour INTEGER DEFAULT 500,
  ai_personalization_enabled BOOLEAN DEFAULT false,
  ai_model TEXT, ai_context TEXT, ai_objective TEXT,
  utilizzi INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns campaign_templates" ON public.campaign_templates
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

No other schema changes needed -- `scheduled_at` already exists on campaigns, `campaigns` already in realtime publication.

## 2. Types Update (`src/types/index.ts`)

Add `CampaignTemplate` interface matching the new table.

## 3. Feature 1: Replica su Liste

**New file: `src/components/campaigns/ReplicaCampagnaDialog.tsx`**
- Dialog with lists from `useLists()` + 3 special segments (all with email, all with phone, not yet contacted)
- Filter special segments by campaign channel type
- On confirm: for each selected target, create campaign copy + call a standalone `populateRecipientsForReplica()` function (simpler than full WizardData-based one -- takes tipo, recipientSource, listId, filterStato)
- Reuse `applyChannelFilter` from campaignHelpers

**Modify: `src/pages/CampaignDetail.tsx`**
- Add "Replica su liste" button in header (visible when stato is bozza or completata)
- Import and render `ReplicaCampagnaDialog`

## 4. Feature 2: Bulk Launch

**Modify: `src/components/campaigns/CampaignsList.tsx`**
- Add optional `selectedIds` and `onSelectionChange` props
- Add checkbox column for bozza campaigns + select-all in header

**Modify: `src/pages/Campaigns.tsx`**
- Add `selectedCampaignIds` state
- Add bulk action bar above CampaignsList when selection > 0
- Bulk launch updates stato to "in_corso" for each selected campaign (n8n trigger happens from CampaignDetail individually)

## 5. Feature 3: Live Dashboard

**New file: `src/hooks/useActiveCampaigns.ts`**
- Subscribe to realtime changes on campaigns table
- Filter for stato in ["in_corso", "pausa"]

**New file: `src/components/campaigns/ActiveCampaignCard.tsx`**
- Progress bar, send count, open rate, click to navigate to detail

**Modify: `src/pages/Campaigns.tsx`**
- Render active campaigns section above the main list when any exist

## 6. Feature 4: Scheduling (already partially done)

The wizard already has `scheduled_at` and `scheduleTime` in WizardData, and `handleCreate` already sets `stato: "schedulata"` when scheduled. The `WizardStepReview` already shows scheduling info.

Need to verify if the date picker UI is actually rendered in the review step. If not, add it.

## 7. Feature 5: Campaign Templates

**Modify: `src/pages/CampaignDetail.tsx`**
- Add "Salva come template" button

**Modify: `src/components/campaigns/CampaignWizard.tsx` (step 0)**
- Load templates matching selected tipo
- Show template grid; clicking one pre-fills wizard data

## Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create (campaign_templates table) |
| `src/types/index.ts` | Add CampaignTemplate |
| `src/components/campaigns/ReplicaCampagnaDialog.tsx` | Create |
| `src/components/campaigns/ActiveCampaignCard.tsx` | Create |
| `src/hooks/useActiveCampaigns.ts` | Create |
| `src/pages/CampaignDetail.tsx` | Add Replica btn + Template btn |
| `src/components/campaigns/CampaignsList.tsx` | Add checkbox selection |
| `src/pages/Campaigns.tsx` | Add bulk launch + active dashboard |
| `src/components/campaigns/CampaignWizard.tsx` | Add template loader in step 0 |

