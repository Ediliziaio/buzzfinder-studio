

# Add "New Lead" Dialog to Pipeline

## What to build

A dialog triggered by a "+ Nuovo Lead" button in the Pipeline header. The dialog lets the user select a contact (searchable), optionally a campaign, set an initial stage and estimated value, then calls `addLead` from `usePipeline`.

## Changes

### 1. Create `src/components/pipeline/CreateLeadDialog.tsx`
- Dialog with form fields:
  - **Contact search**: Input that queries contacts via `supabase.from("contacts").select("id, nome, cognome, azienda, email").ilike(...)` with debounced search, showing results in a dropdown list
  - **Campaign select**: Optional, using `useCampaigns()` to populate a Select dropdown
  - **Stage select**: Default "interessato", using STAGES array
  - **Valore stimato**: Number input, default 0
- On submit: call `addLead({ contact_id, campaign_id, stage })` from the `usePipeline` hook
- Close dialog and reset form on success

### 2. Update `src/pages/Pipeline.tsx`
- Add a `+ Nuovo Lead` button in the header bar next to Filtri
- Import and render `CreateLeadDialog` controlled by `open` state

### 3. Update `src/hooks/usePipeline.ts`
- The `addLead` mutation already exists and accepts `{ contact_id, campaign_id, stage }` — no changes needed

## Files
| File | Action |
|------|--------|
| `src/components/pipeline/CreateLeadDialog.tsx` | Create |
| `src/pages/Pipeline.tsx` | Add button + dialog |

