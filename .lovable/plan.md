

# Edge Function: assign-senders

## What it does

Distributes campaign recipients across active senders based on:
1. Channel match (email senders for email campaigns, etc.)
2. Health score (higher score = more recipients)
3. Warm-up day (limits daily capacity based on warm-up curve)
4. Remaining daily capacity (`max_per_day - inviati_oggi`)

## Algorithm

1. Receive `campaign_id` from request body
2. Fetch campaign to get `tipo` and `user_id`
3. Fetch all active, non-banned senders matching the campaign type for that user
4. For each sender, compute effective capacity: `min(warmup_limit, max_per_day) - inviati_oggi`
5. Fetch all `pending` recipients for the campaign
6. Sort senders by health_score descending
7. Distribute recipients proportionally to each sender's available capacity
8. Update `campaign_recipients.sender_id` in bulk
9. Return summary: `{ assigned, total_recipients, total_capacity_today, senders_used[], warnings[] }`

## Warm-up curve (daily limits by warmup_giorno)

| Days | Limit |
|------|-------|
| 1-3 | 20 |
| 4-7 | 50 |
| 8-14 | 100 |
| 15-21 | 200 |
| 22-30 | 500 |
| 31-60 | 1000 |
| 61-90 | 3000 |
| 90+ | 10000 |

If `warmup_attivo` is false, use `max_per_day` directly.

## Files

| File | Action |
|------|--------|
| `supabase/functions/assign-senders/index.ts` | Create edge function |
| `supabase/config.toml` | Add `verify_jwt = false` config |

## Contract (matches existing frontend call)

**Input:** `{ campaign_id: string }`

**Output:**
```json
{
  "assigned": 150,
  "total_recipients": 150,
  "total_capacity_today": 300,
  "senders_used": [
    { "nome": "Domain 1", "assegnati": 100, "warmup_giorno": 25 },
    { "nome": "Domain 2", "assegnati": 50, "warmup_giorno": 10 }
  ],
  "warnings": []
}
```

Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS (already available as secret).

