

# Part 1 — Update TypeScript Types (`src/types/index.ts`)

## What changes

Update `src/types/index.ts` to align with the full DB schema from the prompt. The current file already has most interfaces but needs additions and refinements.

### Changes to existing interfaces:

1. **Campaign** — Add missing fields: `descrizione`, `tipo_campagna`, `timezone`, `ora_inizio_invio`, `ora_fine_invio`, `solo_lavorativi`, `stop_su_risposta`, `stop_su_disiscrizione`, `tracking_aperture`, `tracking_click`, `custom_tracking_domain`, `paused_at`, `resumed_at`, `pausa_motivo`, `updated_at`

2. **CampaignStep** — Add missing fields: `nome`, `delay_minuti`, `corpo_testo`, `usa_html`, `usa_spintax`, `ab_percentuale`, `stat_schedulati`, `stat_falliti`

3. **CampaignStepExecution** — Add `tracking_id`, `error_message` alias

4. **CampaignRecipient** — Add pipeline fields: `step_corrente`, `prossimo_invio`, `risposta_at`, `pipeline_stage`, `pipeline_note`, `pipeline_updated`

5. **Contact** — Add fields: `ruolo`, `cognome` (make non-null optional), `email_validato`, `email_validato_at`, `ai_intro`, `ai_personalizzato_at`, `ai_modello`, `fonte_dettaglio`

### New interfaces to add:

6. **EmailEvent** — tracking events (open, click, bounce, spam, unsubscribe)
7. **InboxMessage** — unified inbox messages with AI categorization
8. **Unsubscribe** — suppression list entries
9. **BlacklistCheck** — domain blacklist check results
10. **CampaignAnalytics** — aggregated campaign stats view

### Files changed

| File | Action |
|------|--------|
| `src/types/index.ts` | Update existing + add new interfaces |

No database migrations needed — this is purely frontend type alignment.

