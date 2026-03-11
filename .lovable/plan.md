

# MEGA DEBUG — Piano di Analisi e Fix Completo

## Riepilogo Stato Attuale

Il codebase e' gia' in buono stato rispetto ai problemi classici menzionati nel mega prompt. Molti dei bug ipotizzati **non esistono**: nomi colonne sono corretti (`chiave`/`valore`, `contact_id`, `sito_web`), le pagine principali sono tutte costruite e funzionanti, auth e route protection sono implementati, Error Boundary e' presente.

Tuttavia, restano bug reali da fixare. Li elenco ordinati per severita'.

---

## BUG TROVATI

### CRITICO

**C1** — `.single()` in insert+select su ScraperMaps (riga 144) e ScraperWebsites (riga 168)
Queste chiamate sono **corrette** in questo contesto (insert di un solo record), non sono un bug.

**C2** — `.single()` su CampaignDetail riga 64: `supabase.from("campaigns").select("*").eq("id", id!).single()`
Se la campagna non esiste, `.single()` genera un errore non gestito. Il codice gestisce il fallback con `setNotFound(true)` ma l'error viene comunque lanciato. Dovrebbe essere `.maybeSingle()`.

**C3** — `.single()` su campaign_steps riga 121 in CampaignDetail `initializeSequence`. Se non esiste step 1, l'errore di `.single()` viene lanciato prima del check `if (!step1)`. Deve essere `.maybeSingle()`.

**C4** — `.single()` su CampaignWizard riga 304 e ReplicaCampagnaDialog riga 104 per insert+select. Queste sono corrette (insert di un record).

### ALTO

**A1** — `campaign_steps` nel DB **non ha** la colonna `delay_minuti` (verificato dallo schema). Il mega prompt dice che esiste, ma lo schema reale mostra solo `delay_giorni` e `delay_ore`. Il tipo `SequenceStep` in `src/types/index.ts` gia' non include `delay_minuti`, quindi e' coerente.

**A2** — `app_settings` upsert usa `onConflict: "chiave"` ma la tabella non ha un vincolo UNIQUE su `chiave`. Serve verificare. Se manca, ogni upsert crea un duplicato invece di aggiornare. Bisogna aggiungere un indice UNIQUE su `(chiave, user_id)`.

**A3** — `SettingField` e `BlocklistEditor` usano `upsert` con `onConflict: "chiave"` ma `chiave` potrebbe non avere constraint UNIQUE. Se il constraint e' solo sulla coppia `(chiave, user_id)`, il `onConflict` dovrebbe essere `chiave,user_id`.

**A4** — `useSenderPool` usa `supabase.from("sender_pool" as any)` — il cast `as any` nasconde errori di tipo. La tabella `sender_pool` esiste nello schema, quindi il cast e' inutile ma non rotto.

**A5** — Tipo `Campaign` ha `descrizione` nel tipo TS ma la tabella DB non ha questa colonna (non presente nello schema fornito). Questo campo phantom potrebbe causare problemi.

### MEDIO

**M1** — `useAdvancedAnalytics` fetcha TUTTE le campagne senza filtro temporale (`giorni`), poi calcola i totali. Le campagne non sono filtrate per periodo, solo i recipients e inbox. Questo rende i KPI incoerenti col periodo selezionato.

**M2** — `CampaignDetail` riga 64 non filtra per `user_id`, ma RLS lo fa automaticamente. Non e' un bug.

**M3** — `BlocklistEditor` fa `upsert` con `onConflict: "chiave"` ma potrebbe servire `chiave,user_id` per la chiave unica composita.

**M4** — `useContacts` non resetta la pagina a 0 quando i filtri cambiano — la pagina Contacts gestisce questo dall'esterno con `setPage(0)` nel `ContactFiltersBar`, ma va verificato che sia effettivo.

**M5** — `campaigns` nel tipo TS ha `descrizione` che non esiste nel DB. Potrebbe causare cast silently ignorato.

**M6** — Tipo `CampaignStato` include `'errore'` ma il codice non lo gestisce come stato visivo nella `StatusBadge`. Verificare.

### BASSO

**B1** — `AiModelSelector` mostra opzioni "Claude Haiku/Sonnet" ma il progetto usa Lovable AI con modelli Google/OpenAI. I nomi sono fuorvianti per l'utente.

**B2** — `CostProjectionCard` fa breakdown per canale con percentuali hardcoded (60% SMS, 30% WhatsApp). Non e' basato su dati reali.

**B3** — `useSenderPool` non ha error handling sulla fetch.

**B4** — `Deliverability` page `loadSettings` fa `select("*")` su `app_settings` senza filtro — carica tutte le impostazioni. Dovrebbe filtrare per categoria o chiavi specifiche.

---

## PIANO DI FIX (ordinato per severita')

### PASSO 1 — Fix `.single()` → `.maybeSingle()` (C2, C3)

**File:** `src/pages/CampaignDetail.tsx`
- Riga 64: cambiare `.single()` → `.maybeSingle()`
- Riga 121: cambiare `.single()` → `.maybeSingle()`

### PASSO 2 — Verificare/Creare UNIQUE constraint su `app_settings` (A2, A3)

**Azione:** Migration SQL per aggiungere indice UNIQUE su `(chiave, user_id)` se non esiste. Aggiornare tutti gli `upsert` per usare `onConflict: "chiave,user_id"`.

**File da aggiornare:**
- `src/components/settings/SettingField.tsx` — `onConflict: "chiave,user_id"`
- `src/components/settings/SettingToggle.tsx` — stesso
- `src/pages/Settings.tsx` (BlocklistEditor, AiModelSelector) — stesso
- `src/pages/Deliverability.tsx` — stesso

### PASSO 3 — Rimuovere campo phantom `descrizione` da tipo Campaign (A5, M5)

**File:** `src/types/index.ts`
- Verificare se `descrizione` esiste nel DB (dallo schema fornito: **NO**, non e' presente in `campaigns`). Rimuoverlo dal tipo.

### PASSO 4 — Fix filtro temporale in `useAdvancedAnalytics` (M1)

**File:** `src/hooks/useAdvancedAnalytics.ts`
- Aggiungere `.gte("created_at", since)` alla query campaigns per filtrare per periodo.

### PASSO 5 — Fix `Deliverability` loadSettings (B4)

**File:** `src/pages/Deliverability.tsx`
- Filtrare `app_settings` per `.in("chiave", ["email_validator_provider", "email_validator_key"])` invece di `select("*")`.

### PASSO 6 — Aggiungere error handling a `useSenderPool` (B3)

**File:** `src/hooks/useSenderPool.ts`
- Gestire errore nella fetch e mostrare toast.

### PASSO 7 — Aggiornare modelli AI nell'AiModelSelector (B1)

**File:** `src/pages/Settings.tsx`
- Sostituire "Claude Haiku/Sonnet" con modelli Lovable AI supportati (Gemini, GPT).

---

## COSA NON RICHIEDE FIX (gia' corretto)

- Nomi colonne: `chiave`/`valore`, `contact_id`, `sito_web` — tutti corretti
- Auth & Route protection: `RequireAuth` wrapper funzionante, tutte le route definite
- Error Boundary: presente e wrappa tutta l'app
- CSV Import: mappa correttamente `sito_web`
- Inbox/Unibox: funzionante con realtime, filtri, archivio
- Pipeline: Kanban funzionante con drag/move stage
- Senders: pagina completa con health dashboard e alerts
- Analytics: pagina completa con grafici, funnel, heatmap, export CSV
- Navigazione: tutti i link presenti con badge dinamici
- No API keys hardcoded nel frontend
- No SERVICE_ROLE_KEY nel client
- Realtime subscriptions con cleanup corretto
- Paginazione server-side per contatti

