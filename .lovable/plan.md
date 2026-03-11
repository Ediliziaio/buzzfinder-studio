

# Unibox — Posta in Arrivo Unificata

## Current State

No `inbox_messages` table, no edge function, no UI components exist. Everything needs to be created from scratch.

## Plan

### 1. Database Migration

Create `inbox_messages` table:
- `id uuid PK`, `user_id uuid`, `campaign_id uuid`, `recipient_id uuid`, `execution_id uuid`
- `canale text` (email/whatsapp/sms), `da_nome text`, `da_email text`, `da_telefono text`
- `oggetto text`, `corpo text`, `corpo_html text`, `data_ricezione timestamptz`
- `letto boolean DEFAULT false`, `archiviato boolean DEFAULT false`, `assegnato_a uuid`
- `etichetta text DEFAULT 'non_categorizzato'`, `etichetta_ai boolean DEFAULT false`
- `note text`, `thread_id text`, `created_at timestamptz DEFAULT now()`
- RLS: `user_id = auth.uid()`
- Enable realtime

### 2. Edge Function: `handle-reply`

Receives webhook payloads (from email provider / n8n) with reply data. Inserts into `inbox_messages` and optionally classifies via AI using Lovable AI (Gemini Flash) to set `etichetta`.

### 3. New Files

| File | Purpose |
|------|---------|
| `src/pages/Unibox.tsx` | Two-column layout: message list + detail |
| `src/components/unibox/MessageListItem.tsx` | Single message row with label emoji, unread dot, relative time |
| `src/components/unibox/MessageDetail.tsx` | Full message view with label picker, pipeline buttons, archive |
| `src/hooks/useInbox.ts` | Fetch, filter, realtime subscription, markAsRead, updateEtichetta, archive |

### 4. Type Addition

Add `InboxMessage` interface to `src/types/index.ts`.

### 5. Routing & Navigation

- Add route `/unibox` in `App.tsx`
- Add "Unibox" nav item in `AppSidebar.tsx` (with `MessageSquare` icon) between "Campagne" and "Follow-up"
- Show unread count badge in sidebar using a lightweight query

### 6. Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create `inbox_messages` table |
| `supabase/functions/handle-reply/index.ts` | Create edge function |
| `src/types/index.ts` | Add `InboxMessage` interface |
| `src/pages/Unibox.tsx` | Create page |
| `src/components/unibox/MessageListItem.tsx` | Create |
| `src/components/unibox/MessageDetail.tsx` | Create |
| `src/hooks/useInbox.ts` | Create |
| `src/App.tsx` | Add route |
| `src/components/layout/AppSidebar.tsx` | Add nav item with unread badge |

