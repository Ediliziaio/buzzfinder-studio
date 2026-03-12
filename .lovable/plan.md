

# Analisi Criticita — Pipeline/CRM e Automazioni

## Pipeline/CRM

### CRITICO

1. **`valore_stimato` non salvato alla creazione del lead**
   - `CreateLeadDialog` ha il campo "Valore stimato €" (riga 141) ma `handleSubmit` non lo passa a `onAdd`. Il campo `valore` viene ignorato.
   - `addLead` in `usePipeline` non accetta ne inserisce `valore_stimato`.

2. **Nessun controllo duplicati pipeline**
   - `addLead` inserisce senza verificare se il contatto e gia in pipeline. Si possono creare N lead duplicati per lo stesso contatto.

3. **`pipeline_leads` non ha realtime abilitato**
   - `usePipeline` sottoscrive a `postgres_changes` sulla tabella `pipeline_leads`, ma non risulta `ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_leads`. Il canale realtime non ricevera eventi.

4. **Manca `deleteLead`**
   - Non esiste modo di rimuovere un lead dalla pipeline. Una volta creato, resta per sempre (anche se "perso").

### MODERATO

5. **Filtro campagna fragile**
   - Il filtro confronta `l.campaign.nome !== matchCampaign.nome` (riga 41) invece di usare un ID. Se due campagne hanno lo stesso nome, il filtro si rompe. Serve confronto per `campaign_id` diretto (ma il campo non e esposto dal hook).

6. **Conversion rate fuorviante**
   - `conversionRate` divide i lead di ogni stage per il totale attivi. Questo non e un funnel: la somma supera il 100%. Dovrebbe essere calcolato come percentuale del primo stage o sequenziale.

7. **Drag-and-drop non funziona su mobile**
   - `KanbanColumn` usa HTML5 Drag API (`onDragOver`, `onDrop`) che non funziona su touch. Nessun fallback touch.

---

## Automazioni

### CRITICO

8. **Nessun trigger automatico reale**
   - Le regole vengono salvate nel DB ma nessun meccanismo le attiva automaticamente. Non ci sono trigger Postgres, webhook handler, o logic nel `process-sequence` che crei `automation_executions` quando un evento accade (es. email aperta). Il `process-automations` edge function processa solo esecuzioni gia in coda — ma nessuno le inserisce.

9. **`invia_email` e `aggiungi_a_sequenza` non implementati**
   - Nel `process-automations` edge function queste azioni sono TODO stub che ritornano `skipped`. L'utente puo creare regole con queste azioni ma non faranno mai nulla.

10. **`cambia_pipeline_stage` agisce su `campaign_recipients`, non su `pipeline_leads`**
    - L'azione `cambia_pipeline_stage` nell'edge function aggiorna `campaign_recipients.pipeline_stage` (riga ~130), ma il CRM usa la tabella `pipeline_leads`. Le due tabelle non sono sincronizzate — l'azione non ha effetto visibile nel Kanban.

### MODERATO

11. **Log esecuzioni limitato a 100 righe senza paginazione**
    - `fetchExecs` ha `.limit(100)`. Con uso intensivo si perde la visibilita storica. Nessun bottone "carica altri".

12. **Wizard non valida parametri obbligatori**
    - Si puo creare una regola "cambia_pipeline_stage" senza selezionare il `nuovo_stage`, o "notifica_webhook" senza URL. L'edge function fallira a runtime.

---

## Piano di fix proposto

### Blocco 1 — Pipeline (4 fix)
- **Salvare `valore_stimato`**: estendere `addLead` nel hook e passare il valore dal dialog.
- **Deduplicazione**: in `addLead`, verificare con query `.eq("contact_id", ...)` prima di inserire.
- **Abilitare realtime**: migration SQL `ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_leads`.
- **Aggiungere `deleteLead`**: nuova mutation nel hook + bottone "Rimuovi" nel `LeadCard` espanso, con conferma.

### Blocco 2 — Pipeline UX (2 fix)
- **Filtro per campaign_id**: esporre `campaign_id` nel mapping del hook e confrontare per ID.
- **Conversion rate corretto**: calcolare come % cumulativa del primo stage (funnel).

### Blocco 3 — Automazioni (4 fix)
- **Fix `cambia_pipeline_stage`**: nell'edge function, aggiornare `pipeline_leads` invece di `campaign_recipients` (o entrambi). Creare il lead in pipeline se non esiste.
- **Validazione wizard**: impedire salvataggio se parametri obbligatori mancanti (stage, URL, tags).
- **Paginazione log**: aggiungere offset/cursore e bottone "Carica altri".
- **Stub TODO visibili**: mostrare warning nell'UI quando l'utente seleziona azioni non ancora implementate.

### Blocco 4 — Trigger engine (1 fix strutturale)
- **Inserimento automatico `automation_executions`**: creare un trigger Postgres `AFTER INSERT/UPDATE` sulle tabelle rilevanti (`email_events`, `inbox_messages`, `call_sessions`) che inserisca righe in `automation_executions` quando le condizioni di una regola attiva sono soddisfatte. Alternativa: estendere `process-automations` per fare polling delle tabelle eventi.

---

## File coinvolti

| File | Modifiche |
|------|-----------|
| `src/hooks/usePipeline.ts` | addLead con valore, deleteLead, dedup check, esporre campaign_id |
| `src/components/pipeline/CreateLeadDialog.tsx` | Passare valore a onAdd |
| `src/components/pipeline/LeadCard.tsx` | Bottone elimina |
| `src/pages/Pipeline.tsx` | Fix filtro campaign_id, fix conversion rate |
| `src/pages/Automations.tsx` | Validazione wizard, paginazione log, warning stub |
| `supabase/functions/process-automations/index.ts` | Fix cambia_pipeline_stage target table |
| Migration SQL | Realtime per pipeline_leads |

