

# AI Message Personalization Feature

Add Claude AI-powered message personalization to the campaign wizard and detail page. The Edge Function `personalize-messages` is already deployed.

## 1. Database Migration

Add AI columns to `campaigns` and `campaign_recipients`:

```sql
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ai_personalization_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_context TEXT,
  ADD COLUMN IF NOT EXISTS ai_objective TEXT,
  ADD COLUMN IF NOT EXISTS ai_personalization_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_personalization_processed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_personalization_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_eur NUMERIC DEFAULT 0;

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS messaggio_personalizzato TEXT,
  ADD COLUMN IF NOT EXISTS soggetto_personalizzato TEXT;
```

Also insert default `anthropic_api_key` setting row.

## 2. Update Types (`src/types/index.ts`)

Add to `Campaign` interface: `ai_personalization_enabled`, `ai_model`, `ai_context`, `ai_objective`, `ai_personalization_status`, `ai_personalization_processed`, `ai_personalization_total`, `ai_cost_eur`.

Add to `CampaignRecipient`: `messaggio_personalizzato`, `soggetto_personalizzato`.

## 3. Settings (`src/pages/Settings.tsx`)

Add `anthropic_api_key` field to `apiKeyFields` array with `isSecret: true`.

## 4. New Component: `WizardStepAI.tsx`

Create `src/components/campaigns/WizardStepAI.tsx` with:
- Toggle to enable/disable AI personalization
- Model selection (Haiku vs Sonnet) with cost estimates
- Context textarea (who you are, 300 char max)
- Objective textarea (message goal, 200 char max)
- Cost estimate display based on recipient count and model
- Data tags showing what contact info is used

## 5. Campaign Wizard Updates (`CampaignWizard.tsx`)

- Add `aiEnabled`, `aiModel`, `aiContext`, `aiObjective` to `WizardData` and `defaultData`
- Add new step "AI ✨" between "Contenuto" and "Riepilogo" (STEPS array becomes 5 items)
- Render `WizardStepAI` for step 3, shift review to step 4
- `canNext()` for step 3: always true (AI is optional)
- `handleCreate()`: save `ai_personalization_enabled`, `ai_model`, `ai_context`, `ai_objective`, `ai_personalization_status: "none"` in the campaign insert

## 6. New Component: `AiPersonalizationPanel.tsx`

Create `src/components/campaigns/AiPersonalizationPanel.tsx`:
- Shown in CampaignDetail when `ai_personalization_enabled === true`
- "Genera messaggi personalizzati" button that calls `personalize-messages` Edge Function in a batched loop (20 per batch)
- Progress bar with processed/total count and cost
- Preview of first generated messages
- Stop button, retry on failure
- Updates campaign `ai_personalization_status` in DB

## 7. CampaignDetail Updates (`src/pages/CampaignDetail.tsx`)

- Import and render `AiPersonalizationPanel` when `campaign.ai_personalization_enabled`
- Add `use_personalized_messages` flag to the n8n launch payload

## 8. WizardStepReview Update

Add AI summary section showing model, context, objective, and estimated AI cost when `aiEnabled` is true.

## 9. Analytics Update (`src/pages/Analytics.tsx`)

Add KPI card showing total AI cost and personalized message count from campaigns with `ai_cost_eur > 0`.

## Files

| File | Action |
|------|--------|
| Migration SQL | Create (AI columns) |
| `src/types/index.ts` | Add AI fields |
| `src/pages/Settings.tsx` | Add anthropic_api_key |
| `src/components/campaigns/WizardStepAI.tsx` | Create |
| `src/components/campaigns/AiPersonalizationPanel.tsx` | Create |
| `src/components/campaigns/CampaignWizard.tsx` | Add AI step + save fields |
| `src/components/campaigns/WizardStepReview.tsx` | Add AI summary |
| `src/pages/CampaignDetail.tsx` | Add panel + payload flag |
| `src/pages/Analytics.tsx` | Add AI cost KPI |

