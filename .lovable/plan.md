

# Piano di correzione completo: Integrazione Email / SMS / WhatsApp

Questo piano implementa tutti i 15 bug fix descritti nel prompt, organizzati per priorita.

---

## Migrazione Database (eseguire per prima)

Una singola migration SQL che:
- Aggiunge `campaign_recipients` e `contact_activities` a `supabase_realtime`
- Aggiunge colonne WhatsApp: `template_whatsapp_language TEXT DEFAULT 'it'`, `template_whatsapp_variables JSONB DEFAULT '[]'`
- Aggiunge colonne di controllo: `paused_at`, `stopped_at` su `campaigns`
- Aggiunge colonne di tracking: `triggered_at`, `clicked_at`, `opened_at` su `campaign_recipients`
- Crea indice `idx_campaign_recipients_stato` su `(campaign_id, stato)`

Nota: `suppression_list` esiste gia. Non si ricrea.

---

## Task 1 -- Popolamento campaign_recipients (Bug C1)

**File:** `src/components/campaigns/CampaignWizard.tsx`

- Estrarre `applyChannelFilter` e `applyDynamicFilters` da `WizardStepRecipients.tsx` in un nuovo file `src/lib/campaignHelpers.ts` condiviso.
- Modificare `handleCreate()`: cambiare l'insert per usare `.select("id").single()` e ottenere l'ID campagna.
- Dopo l'insert, chiamare `populateCampaignRecipients(campaignId, data)` che:
  - Risolve i contact IDs in base a `recipientSource` (all / list statica / list dinamica / filter)
  - Inserisce in `campaign_recipients` in chunk da 500 con `stato: "pending"`
- Gestire errori con rollback (delete campagna se il popolamento fallisce).

**File nuovo:** `src/lib/campaignHelpers.ts`
- Contiene `applyChannelFilter()`, `applyDynamicFilters()`, `populateCampaignRecipients()`

---

## Task 2 -- Payload n8n con supabase_url/key (Bug C2)

**File:** `src/pages/CampaignDetail.tsx`

- Aggiungere al payload n8n in `handleStatusChange()`:
  - `supabase_url: import.meta.env.VITE_SUPABASE_URL`
  - `supabase_anon_key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`

La variabile env si chiama `VITE_SUPABASE_PUBLISHABLE_KEY` (non ANON_KEY) ed e gia configurata nel `.env`.

---

## Task 3 -- Webhook controllo pausa/stop (Bug C5)

**File:** `src/pages/CampaignDetail.tsx`, `src/services/n8n.ts`, `src/pages/Settings.tsx`

- In `getN8nSettings()`: aggiungere `"n8n_webhook_campaign_control"` alla lista di chiavi.
- In `Settings.tsx`: aggiungere il campo `n8n_webhook_campaign_control` in `apiKeyFields`.
- In `handleStatusChange()`: quando stato diventa `pausa` o `completata`, inviare un webhook di controllo a n8n con `{ campaign_id, action: "pause" | "stop" }`. Per `in_corso` da pausa, inviare `action: "resume"`. Aggiornare anche `paused_at` / `stopped_at`.

---

## Task 4 -- Salvataggio n8n execution ID (Bug M5)

**File:** `src/pages/CampaignDetail.tsx`

- Salvare il risultato di `triggerN8nWebhook` e scrivere `n8n_webhook_id` nella campagna.
- In caso di errore n8n, riportare la campagna a stato `bozza`.

---

## Task 5 -- Template WhatsApp variables (Bug C4)

**File:** `src/components/campaigns/CampaignWizard.tsx`, `src/types/index.ts`

- Aggiungere a `WizardData`: `template_whatsapp_language: string`, `template_whatsapp_variables: { index: number; tipo: "campo" | "fisso"; valore: string }[]`
- Nello step 2 WhatsApp: aggiungere select lingua, lista dinamica di variabili con mapping campo/fisso, pulsante aggiungi/rimuovi.
- Salvare nel DB e includere nel payload n8n.

---

## Task 6 -- Costo stimato corretto (Bug M6)

**File:** `src/components/campaigns/CampaignWizard.tsx`

- Importare `calculateCost` da `@/lib/costCalculator`.
- Sostituire `data.recipientCount * canale.costPer` con `calculateCost(data.tipo, data.recipientCount, data.body_text.length).totalCost`.

---

## Task 7 -- SMS GSM7 vs UCS-2 (Bug M1)

**File:** `src/components/campaigns/CampaignWizard.tsx`, `src/lib/costCalculator.ts`

- Aggiungere funzione `isGsm7Only(text)` in `costCalculator.ts`.
- Nello step 2 SMS del wizard: usare 70 come limite per UCS-2 (67 per concatenati), mostrare warning se non-GSM7.
- Aggiornare `calculateSmsCost` per considerare la codifica UCS-2.

---

## Task 8 -- Auto-generazione body_text (Bug M2)

**File:** `src/lib/campaignHelpers.ts`, `src/components/campaigns/CampaignWizard.tsx`

- Aggiungere funzione `htmlToPlainText(html)` in campaignHelpers.
- In `handleCreate()`, se tipo e `email`, generare automaticamente `body_text` dall'HTML.

---

## Task 9 -- Sender defaults pre-caricati (Bug M3)

**File:** `src/components/campaigns/CampaignWizard.tsx`, `src/pages/Settings.tsx`

- Nel `useEffect` su `open`: caricare da `app_settings` le chiavi `sender_name_default`, `sender_email_default`, `reply_to_default` e pre-popolare i campi del wizard.
- In Settings: aggiungere queste 3 chiavi nella sezione Mittenti se non presenti.

---

## Task 10 -- Validazione sender_email (Bug M4)

**File:** `src/components/campaigns/CampaignWizard.tsx`

- In `canNext()` step 2 email: richiedere che `sender_email` sia valorizzato e valido (regex).
- Per WhatsApp: richiedere anche `template_whatsapp_language`.
- Mostrare messaggio di errore inline sotto il campo sender_email se invalido.

---

## Task 11 -- Bug minori (mi1, mi2, mi3, mi4)

**mi1 - Duplica campagna** (`src/pages/Campaigns.tsx`): aggiungere `totale_destinatari` e `costo_stimato_eur` nell'insert duplicato.

**mi2 - Campaign not found** (`src/pages/CampaignDetail.tsx`): aggiungere stato `notFound` separato da `loading`, mostrare messaggio e link per tornare alle campagne.

**mi3 - n8n keys consistency** (`src/services/n8n.ts`): aggiungere `"n8n_webhook_campaign_control"` (gia coperto nel Task 3).

**mi4 - Email preview variabili**: `EmailPreviewDialog.tsx` gia implementa `replaceVariables` con sample vars. Nessun fix necessario -- il codice e gia corretto.

---

## Riepilogo file modificati

| File | Operazione |
|------|-----------|
| `src/lib/campaignHelpers.ts` | Nuovo -- funzioni condivise |
| `src/components/campaigns/CampaignWizard.tsx` | C1, C4, M1, M2, M3, M4, M6 |
| `src/components/campaigns/WizardStepRecipients.tsx` | Refactor import da campaignHelpers |
| `src/pages/CampaignDetail.tsx` | C2, C5, M5, mi2 |
| `src/services/n8n.ts` | mi3 |
| `src/pages/Settings.tsx` | C5, M3 |
| `src/pages/Campaigns.tsx` | mi1 |
| `src/lib/costCalculator.ts` | M1 (GSM7) |
| `src/types/index.ts` | C4 (WhatsApp types) |
| Migration SQL | C3, C4, C5 |

