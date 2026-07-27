# services/sync/Dockerfile
#
# Daily Supabase → Twenty CRM sync.
#
# ⛔ SUPABASE IS READ-ONLY. This container reads from Supabase and writes ONLY
# to Twenty's Postgres. The script enforces that itself — `supabaseRest()`
# throws on any non-GET, `upsertSyncMap()` is a no-op, and the direct Postgres
# path connects with `default_transaction_read_only=on` so the SERVER rejects
# a write even if application code asked for one.

FROM node:22-alpine

WORKDIR /app

# Only the sync script and its lockfile — keep the image small and the
# blast radius of a rebuild tiny.
COPY scripts/xopure/sync-supabase-to-twenty/package.json ./
COPY scripts/xopure/sync-supabase-to-twenty/package-lock.json ./
RUN npm ci --omit=dev

COPY scripts/xopure/sync-supabase-to-twenty/index.mjs ./
COPY scripts/xopure/sync-supabase-to-twenty/lib ./lib

# Railway runs this on the schedule in railway.toml: one sync per invocation,
# then exit. A non-zero exit is what makes a failed run visible.
CMD ["node", "./index.mjs"]
