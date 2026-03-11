

# Part 2 — Update Navigation & Add Missing Routes

## What to build

Reorganize the sidebar navigation and add two new standalone pages (`Senders` and `Deliverability`) that are currently embedded as tabs inside Settings.

## Changes

### 1. Create `src/pages/Senders.tsx`
- Extract the "Pool Mittenti" tab content from Settings into its own page
- Includes sender list, health dashboard, filters, add/edit/delete sender functionality
- Reuses existing components: `SenderCard`, `SenderDialog`, `SenderHealthDashboard`

### 2. Create `src/pages/Deliverability.tsx`
- Extract the "Deliverability" tab content from Settings into its own page
- Includes `BlacklistMonitor` and deliverability settings (custom tracking domain, etc.)

### 3. Update `src/components/layout/AppSidebar.tsx`
- Reorganize nav items per the prompt:
  - Dashboard (`/`) — new entry with `LayoutDashboard` icon
  - Contatti (`/contacts`)
  - Liste (`/lists`)
  - Campagne (`/campaigns`)
  - Unibox (`/unibox`) — keep existing badge
  - Analytics (`/analytics`)
  - Pipeline CRM (`/pipeline`) — use `Kanban` icon
  - Scraper Maps (`/scraper/maps`)
  - Scraper Siti (`/scraper/websites`)
  - Pool Mittenti (`/senders`) — new, with `AtSign` icon + unhealthy sender badge (yellow)
  - Deliverability (`/deliverability`) — new, with `ShieldCheck` icon
  - Impostazioni (`/settings`)
- Add unhealthy sender count badge using `useSenderPool`

### 4. Update `src/App.tsx`
- Add routes for `/senders` and `/deliverability`
- Import new page components

### 5. Update `src/pages/Settings.tsx`
- Remove "Pool Mittenti" and "Deliverability" tabs (now separate pages)
- Keep remaining tabs: API Keys, Webhook n8n, General settings, Export

## Files

| File | Action |
|------|--------|
| `src/pages/Senders.tsx` | Create — extracted from Settings |
| `src/pages/Deliverability.tsx` | Create — extracted from Settings |
| `src/components/layout/AppSidebar.tsx` | Update nav items + sender badge |
| `src/App.tsx` | Add new routes |
| `src/pages/Settings.tsx` | Remove extracted tabs |

