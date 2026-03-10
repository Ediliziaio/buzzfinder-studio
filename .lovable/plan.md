

## Plan: Enhance List Selection in Campaign Wizard

### Current State
The wizard already has a "Da una lista" option that queries `list_contacts` for static lists. However:
1. **Dynamic lists are ignored** -- selecting a dynamic list returns 0 because no rows exist in `list_contacts`; the saved `filtri` JSON is never evaluated.
2. **No channel filtering on lists** -- selecting a list for an email campaign includes contacts without email addresses.
3. **No list type indicator** -- users can't distinguish static from dynamic lists in the dropdown.

### Changes

**`src/components/campaigns/WizardStepRecipients.tsx`**
- When `recipientSource === "list"` and the selected list has `tipo === "dinamica"`, apply the list's `filtri` JSON to query `contacts` directly (same logic used in Lists page) instead of querying `list_contacts`.
- For static lists, join through `list_contacts` but also filter by channel requirements (email not null for email campaigns, telefono not null for SMS/WhatsApp).
- Show list type badge (Statica/Dinamica) next to each list name in the Select dropdown.
- Show a brief description of the dynamic filters below the select when a dynamic list is chosen.

**`src/hooks/useLists.ts`**
- No changes needed; already returns full list objects including `tipo` and `filtri`.

**`src/types/index.ts`**
- Verify `ContactList` type includes `filtri` and `tipo` fields (already present from Phase 5).

### Implementation Details

For dynamic list recipient counting, parse the `filtri` JSON and build the Supabase query dynamically:
```
filtri: { stato: ["nuovo"], hasEmail: true, citta: "Milano", fonte: "google_maps" }
```
Each key maps to a `.eq()` / `.in()` / `.not(..., "is", null)` filter, mirroring the logic in `ListContactsManager`. Then layer on the channel filter (email/phone not null).

For static lists, use a two-step approach: fetch `list_contacts` contact IDs, then count contacts matching those IDs + channel requirement. This ensures accurate counts.

