

# Deliverability Suite Enhancement — MX/SMTP Validation + Auto-Notifications

## Plan

### 1. Enhanced `validate-emails` Edge Function with MX Lookup

Upgrade `supabase/functions/validate-emails/index.ts` to perform real DNS MX record lookups using Deno's DNS API (`Deno.resolveDns`). This adds a server-side MX check without requiring external API keys:

- After regex/disposable/risky checks, resolve MX records for the domain
- If no MX records found → mark as `invalid`
- If MX resolves → mark as `valid` (or `risky` if role prefix)
- Add optional support for external validator API key (MillionVerifier/ZeroBounce) read from `app_settings`: if key present, call their API for SMTP-level verification; otherwise fall back to MX-only

### 2. Settings — Email Validator Provider Selector

Update the Deliverability tab in `src/pages/Settings.tsx`:
- Add a dropdown to select provider: "Solo MX (gratuito)" / "MillionVerifier" / "ZeroBounce"
- Save selection as `email_validator_provider` in `app_settings`
- The existing API key field already exists — just wire the provider selector

### 3. In-App Sender Health Notifications

Create a new component `src/components/senders/SenderAlertNotifications.tsx` that:
- Runs on the Settings/Senders tab mount (or via a shared hook)
- Checks all senders for threshold breaches: bounce_rate > 0.02 (warning), > 0.05 (critical); spam_rate > 0.001 (warning), > 0.003 (critical)
- Shows toast notifications via `sonner` for each sender exceeding thresholds
- Persists "dismissed" state in localStorage to avoid spamming on every page load (dismiss for 24h)

Also integrate alerts into the `AppLayout` so they fire on app load (not just Settings page):
- Add a `useSenderAlerts` hook that fetches sender_pool on mount, checks thresholds, fires toasts once per session

### 4. Files Summary

| File | Action |
|------|--------|
| `supabase/functions/validate-emails/index.ts` | Add MX lookup + optional external API |
| `src/pages/Settings.tsx` | Add provider selector dropdown |
| `src/hooks/useSenderAlerts.ts` | Create — check thresholds on app load, fire toasts |
| `src/components/layout/AppLayout.tsx` | Add `useSenderAlerts()` call |

