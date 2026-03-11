

# Piano: Collegare Avvio Campagna al Nuovo Sistema

## Analisi stato attuale

Il file `CampaignDetail.tsx` ha gia' un flusso di lancio ben strutturato:
- `handleLaunchCampaign` chiama `assign-senders`, mostra risultati in `AssignmentResultDialog`
- `confirmLaunchAfterAssignment` chiama `initializeSequence` + `handleStatusChange`
- `initializeSequence` crea le `campaign_step_executions` per step 1
- `handleStatusChange` aggiorna stato e triggera webhook n8n

Il flusso e' gia' funzionante. Le modifiche richieste sono un refactoring per consolidare la logica e aggiungere:
1. Gestione pausa/stop con cancellazione executions schedulate
2. Fallback n8n solo quando non ci sono step configurati
3. Loading state `isLaunching` sul pulsante
4. Mostrare `SequenceProgress` anche per campagne non-sequence quando in corso

## Cosa modificare

| File | Azione |
|------|--------|
| `src/pages/CampaignDetail.tsx` | Refactor `handleStatusChange` per gestire pausa/stop con cancellazione executions; aggiungere `isLaunching` state; migliorare gestione errori |

## Dettagli implementazione

### 1. Aggiungere `isLaunching` state (gia' parzialmente coperto da `isAssigning`)
- Rinominare/unificare in `isLaunching` per chiarezza

### 2. Refactor `handleStatusChange` per pausa/stop
- **Pausa**: cancellare executions `scheduled` future + aggiornare stato a `in_pausa`
- **Stop/completata**: cancellare tutte le executions `scheduled` + aggiornare stato
- **Riprendi**: solo update stato (le executions vengono ri-schedulate dal process-sequence)

### 3. Migliorare fallback n8n
- Nel flusso `in_corso`: se ci sono step configurati, NON triggerare webhook n8n (il process-sequence gestisce tutto)
- Solo se NON ci sono step → usa il vecchio flusso n8n diretto
- Rimuovere il rollback a `bozza` su errore n8n quando il sistema sequenze e' attivo

### 4. SequenceProgress per tutte le campagne in corso
- Mostrare il componente `SequenceProgress` per qualsiasi campagna `in_corso` che ha step configurati, non solo per `tipo_campagna === "sequence"`

## Cosa NON toccare
- Il flusso `handleLaunchCampaign` + `AssignmentResultDialog` funziona bene e va mantenuto
- `initializeSequence` e' gia' corretta
- Il componente `SequenceProgress` esiste gia' e funziona

