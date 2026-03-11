

# Unibox Enhancement Plan

## Current State
The Unibox already has: 2-column layout, etichetta/canale filters, message list with realtime, detail view with etichetta selector + archive + pipeline button, unread badge in sidebar. The `useInbox` hook and `useInboxUnreadCount` are functional.

## What Needs Enhancement

### 1. Upgrade `useInbox` hook
- Add `searchQuery` and `filtroCampagna` filter options
- Add `markAsUnread`, `saveNote` actions
- Add `filtroArchiviato` toggle support

### 2. Enhance `Unibox.tsx` page layout → 3-column
- Add search bar above message list
- Add campaign dropdown filter
- Add archive toggle
- Add all etichetta categories (referral, obiezione, appuntamento_fissato, non_categorizzato)
- Show contact info panel on right side of detail

### 3. Enhance `MessageListItem.tsx`
- Add avatar with initials
- Add channel badge overlay on avatar
- Show azienda if available (from local message data)

### 4. Enhance `MessageDetail.tsx`
- Add "mark as unread" button
- Add note interne textarea with save
- Add contact info panel (fetched on selection)
- Add pipeline stage visual selector
- Add campaign name display

### 5. New component: `ContactInfoPanel.tsx`
- Fetch contact by `da_email` or `da_telefono`
- Show: nome, cognome, azienda, email, sito_web (clickable), linkedin
- Show pipeline stage selector
- Show note interne editor
- Link to contact detail page

### 6. New component: `EtichettaBadge.tsx`
- Styled badge with color-coded backgrounds per category
- Reusable across list items and detail

### 7. Browser notifications
- Request permission prompt banner in Unibox page
- Send notification on realtime INSERT in useInbox

### 8. DB Migration
- Enable realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;`

## Files to Create
- `src/components/unibox/ContactInfoPanel.tsx`
- `src/components/unibox/EtichettaBadge.tsx`

## Files to Edit
- `src/hooks/useInbox.ts` — add search, campaign filter, archive toggle, markAsUnread, saveNote
- `src/pages/Unibox.tsx` — 3-column layout, search, campaign filter, archive toggle, all categories, notification prompt
- `src/components/unibox/MessageListItem.tsx` — avatar, channel badge
- `src/components/unibox/MessageDetail.tsx` — unread button, note, contact panel integration

## Migration
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;
```

