

# Piano: Storia Invii nel Pannello Contatto Unibox

## Cosa costruire

Aggiungere una terza Card "Storia Invii" nel `ContactInfoPanel.tsx` che mostra tutti gli step inviati al contatto dalla tabella `campaign_step_executions`, con stato (sent/scheduled/error), data invio, e indicatore apertura.

## Come funziona

1. Quando il contatto viene trovato, cercare il suo `contact_id` nella tabella `campaign_recipients` per ottenere i `recipient_id`
2. Con quei `recipient_id`, caricare da `campaign_step_executions` tutti gli step eseguiti
3. Fare join con `campaign_steps` per ottenere il nome/numero dello step e con `campaigns` per il nome campagna
4. Mostrare in una timeline compatta: icona stato (verde=sent, giallo=scheduled, rosso=error), data, nome step, e icona occhio blu se `opened_at` presente

## File da modificare

| File | Azione |
|------|--------|
| `src/components/unibox/ContactInfoPanel.tsx` | Aggiungere fetch executions + Card "Storia Invii" |

## Dettagli query

```typescript
// 1. Trova recipient_ids per il contatto
const { data: recipients } = await supabase
  .from("campaign_recipients")
  .select("id, campaign_id")
  .eq("contact_id", contact.id);

// 2. Carica executions per quei recipients
const { data: executions } = await supabase
  .from("campaign_step_executions")
  .select("id, stato, sent_at, scheduled_at, opened_at, clicked_at, step_id, campaign_id, error")
  .in("recipient_id", recipientIds)
  .order("created_at", { ascending: false })
  .limit(20);

// 3. Carica step names + campaign names
```

## UI della Card

- Card con titolo "📊 Storia Invii"
- Ogni riga: dot colorato (verde/giallo/rosso) + data + "Step N" + icona occhio se aperto
- Nome campagna in sottotesto
- Loader durante il caricamento
- "Nessun invio trovato" se vuoto

