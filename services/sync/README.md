# Daily Supabase → Twenty sync

Runs `scripts/xopure/sync-supabase-to-twenty` once a day as a Railway cron service.

## 🔒 Read-only contract

**Supabase is never written to.** Verified in `index.mjs`:

| Guard | Where |
|---|---|
| REST throws on any non-`GET` | `supabaseRest()`, line ~478 |
| No `POST`/`PATCH`/`PUT`/`DELETE` anywhere in the file | — |
| `upsertSyncMap()` is a logging no-op | line ~583 |
| Direct Postgres opens `default_transaction_read_only=on` | line ~332 |

That last one matters most: the **server** rejects a write, so a future code
change cannot quietly reintroduce one.

The sync writes only to **Twenty's** Postgres. That direction is intentional —
Twenty is the mirror, Supabase is the source of truth.

## Prerequisites

⚠️ **The sync currently fails without the app upgrade.** It stops at:

```
Twenty ambassador table is missing personId. Install the XO Pure CRM app first.
```

`personId` comes from `fields/person-on-ambassador.field.ts`, which ships in app
0.1.4. Production runs 0.1.2. So the order is:

1. Fix the object-declaration gap (audit finding **F3c**) so installing does not
   drop 6 tables / 1,229 rows.
2. Install the app.
3. Then this service will run clean.

## Environment

Set on the Railway service:

| Variable | Value |
|---|---|
| `TWENTY_PG_URL` | Reference the `Postgres` service — use the **internal** host so no TLS opt-out is needed |
| `TWENTY_WORKSPACE_SCHEMA` | `workspace_<your-workspace-id>` (required — no default) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Read-only usage today; see below |

`DRY_RUN=1` reads and plans without writing to Twenty — always use it first
after any schema change.

### Prefer `crm_readonly` over the service-role key

The service-role key bypasses RLS. The sync only ever reads, but the key itself
is over-privileged. Gate 4 of the master plan replaces it:

```
SUPABASE_SYNC_SOURCE=pg
SUPABASE_PG_URL=postgresql://crm_readonly:...@db.<project>.supabase.co:5432/postgres
```

That path already connects with `default_transaction_read_only=on`, so it is
strictly safer than the REST + service-role route. Do this when the
`crm_readonly` role exists.

### Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`

Railway's **public** Postgres proxy uses a self-signed certificate, so running
this from a laptop needs a TLS opt-out. Inside Railway, connect over
`postgres.railway.internal` instead — no TLS opt-out, and nothing
process-wide is weakened.

## Schedule

`12 9 * * *` — daily at 09:12 UTC (~03:12 CST). Offset from the `:07` hourly
backup so the two never contend, and well clear of the Fri 00:00 CST comp-week
rollover.

## What one run does

Products → customers → ambassadors (with genealogy rollups and orphan triage)
→ orders. It logs a genealogy health line each run, e.g.:

```
genealogy: 1 root(s), 0 dangling parent_id, 8 flagged needs_sponsor_review, 0 node(s) on a cycle
```

Treat a rising `dangling parent_id` or any non-zero cycle count as a data
incident — the tree rollups cannot be trusted until it is resolved.
