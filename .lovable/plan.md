

## LeadHunter Pro — Implementation Plan (Phase 1: Core Foundation)

### 1. Design System & Theme Setup
- Apply the dark "Terminale da Guerra" theme with CSS variables (dark backgrounds, green terminal accent, custom fonts)
- Import JetBrains Mono, IBM Plex Sans, Space Mono fonts
- Configure Tailwind with custom colors and override shadcn theme
- Create shared components: StatusBadge, ProgressBar, KPI Card, CostEstimator

### 2. App Layout & Navigation
- Sidebar (220px expanded / 52px collapsed) with all 7 navigation items and smooth collapse animation
- Top header with breadcrumbs, credit pills (Email/SMS/WhatsApp remaining), and n8n status indicator
- React Router setup for all routes: `/scraper/maps`, `/scraper/websites`, `/contacts`, `/lists`, `/campaigns`, `/analytics`, `/settings`

### 3. Authentication
- Supabase Auth with email/password login
- Simple login page matching the dark terminal theme
- Single admin account setup

### 4. Database Schema
- Connect external Supabase project
- Create all tables: contacts, scraping_sessions, scraping_jobs, campaigns, campaign_recipients, contact_activities, app_settings, usage_log, lists, list_contacts
- All indexes for performance on 50k+ records
- RLS policies on all tables
- Enable Realtime on scraping_sessions, scraping_jobs, campaigns

### 5. Contacts Page (Core Hub)
- TanStack Table with virtual scrolling for 50k+ rows
- Sticky filter bar with search, dropdowns (stato, fonte, città, tag, ha email, ha tel, data), saved filter pills
- Bulk action bar (animated from bottom) for email/SMS/WhatsApp/status/tag/list/delete
- Contact detail drawer (520px right panel) with all fields, notes with autosave, and activity timeline
- CSV Import wizard: drag & drop upload → column mapper → duplicate options → preview → progress bar
- CSV Export with streaming download

### 6. Settings Page
- Tab: API Keys — forms for Google Maps, ScrapingBee, n8n, Resend, Telnyx, Meta WhatsApp with test buttons and status indicators
- Tab: Senders — manage verified email senders
- Tab: Limits — daily sending limits, delays, blocklist
- Tab: Import/Export — links to import/export features

---

**After Phase 1 is implemented and tested, we'll continue with:**

**Phase 2**: Scraper Maps page (config panel + live results + Google Maps integration via n8n webhook)

**Phase 3**: Scraper Websites page (queue system + enrichment results + ScrapingBee integration)

**Phase 4**: Campaigns page (full wizard: email/SMS/WhatsApp composers, recipient selector, cost estimator, campaign detail view)

**Phase 5**: Lists page (static/dynamic lists, filter builder)

**Phase 6**: Analytics page (KPI cards, Recharts charts, cost projections)

**Phase 7**: Real-time integrations (Supabase Realtime subscriptions, n8n webhook orchestration, live progress updates)

