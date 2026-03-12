

# Piano: Fix Memory Leak e Robustezza in ScraperWebsites

## Problemi identificati nel codice attuale

1. **useEffect riga 100-118** (fetch contacts): nessun cleanup — se il componente si smonta o `completedJobContactIds` cambia, la promise `.then()` scrive su state smontato.
2. **Chiamate async sparse** (`handleImportFromMaps`, `handleShowDetail`, `handleLoadPreviousSession`): non cancellabili, ma essendo user-triggered sono meno critiche.
3. **Realtime subscription** (riga 69-87): il cleanup esiste (`removeChannel`), ma aggiornamenti ad alta frequenza causano troppi re-render.
4. **Nessun limite sui risultati**: `enrichedContacts` può crescere illimitatamente in memoria.
5. **Nessuna gestione specifica errori di rete**.

## Modifiche

### 1. AbortController + isMounted nel fetch contacts (righe 100-118)
- Creare un flag `cancelled` nel useEffect
- Nel cleanup, impostare `cancelled = true` per impedire `setEnrichedContacts` dopo smontaggio
- Nota: il client Supabase JS non supporta `AbortSignal` nativamente, quindi usiamo il pattern `cancelled` flag

### 2. Debounce realtime updates (righe 69-87)
- Accumulare gli update realtime dei jobs in un buffer con `setTimeout` di 300ms
- Applicare tutti gli update in batch in un singolo `setJobs` call, riducendo i re-render
- Pulire il timeout nel cleanup dell'useEffect

### 3. Warning memoria + virtualizzazione risultati
- In `ScraperWebsitesPage`: se `enrichedContacts.length > 1000`, mostrare un banner warning con suggerimento di esportare
- In `WebScraperResults`: wrappare la tabella in un `ScrollArea` con altezza fissa (già presente come overflow-auto) — aggiungere virtualizzazione con `@tanstack/react-virtual` per la tabella dei risultati quando i completedJobs superano 500 righe

### 4. Gestione errori di rete
- Wrappare le chiamate async principali (`handleStart`, `handleResume`, `handleRetryJob`) con check specifico per errori di rete (`err.message` contiene "network" o `err.code === "ECONNABORTED"`)
- Mostrare toast con bottone "Riprova" usando `toast.error(..., { action: { label: "Riprova", onClick: retry } })`

## File coinvolti

| File | Modifiche |
|------|-----------|
| `src/pages/ScraperWebsites.tsx` | Cancelled flag su fetch contacts, debounce realtime, warning 1000+ contatti, gestione errori rete |
| `src/components/scraper/WebScraperResults.tsx` | Virtualizzazione righe con `@tanstack/react-virtual` |

