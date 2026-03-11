

# Drag-and-Drop Kanban + Weekly Deliverability Report

## Part 1: Drag-and-Drop Pipeline

Use native HTML5 Drag and Drop API (no new dependencies needed).

### LeadCard changes
- Add `draggable="true"`, `onDragStart` handler that sets `dataTransfer` with `lead.id`
- Add visual feedback class during drag (`opacity-50`)

### KanbanColumn changes
- Add `onDragOver` (preventDefault to allow drop), `onDrop` handler that reads lead ID and calls `onMoveStage(leadId, stage.id)`
- Add visual highlight on drag-over state (e.g. `bg-primary/10` ring)

### Pipeline.tsx
- No changes needed — `moveStage` already handles any stage-to-stage movement

### Files changed
| File | Action |
|------|--------|
| `src/components/pipeline/LeadCard.tsx` | Add draggable + onDragStart |
| `src/components/pipeline/KanbanColumn.tsx` | Add onDragOver + onDrop with highlight |

## Part 2: Weekly Deliverability Report Edge Function

Create `supabase/functions/weekly-report/index.ts` that:
1. Queries all active senders per user from `sender_pool`
2. Queries recent `blacklist_checks`
3. Builds an HTML email summary with health scores, bounce/spam rates, blacklist status
4. Sends via Resend (using first active email sender's API key) or logs if no sender configured

Schedule via `pg_cron` to run weekly (Sundays at 9am).

### Files changed
| File | Action |
|------|--------|
| `supabase/functions/weekly-report/index.ts` | Create edge function |
| `supabase/config.toml` | Add `[functions.weekly-report]` |
| SQL (non-migration) | Schedule pg_cron job |

