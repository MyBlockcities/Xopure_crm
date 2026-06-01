# Railway Live Debug Notes

## 2026-05-08 Frontend 502

Observed `https://crm.xopure.com` returning Railway `502 Application failed to respond`.

Root cause from Railway status/logs:

- Service `Xopure_crm` deployed with `RAILPACK` from the repository root.
- Root `package.json` `npm start` is a development command that starts `twenty-server:start` and `twenty-front:start`.
- The frontend Vite dev server listens on localhost only, so Railway cannot expose it.
- Backend tried local Postgres at `127.0.0.1:5432` because `PG_DATABASE_URL` was not set.
- Custom domain target port was `8080`.

Fix:

- Add root `railway.toml` pointing the root-linked service at `services/server/Dockerfile`.
- Keep the custom domain target port at `8080` and set the app to listen on `NODE_PORT=8080` / `PORT=8080`.
- Provision Railway Postgres and Redis for Twenty internal state.
- Set production Twenty variables on the web service: `PG_DATABASE_URL`, `REDIS_URL`, `APP_SECRET`, `SERVER_URL`, `NODE_PORT`, `MESSAGE_QUEUE_TYPE`, and signup/storage/email settings.

## 2026-06-01 Dashboard runtime mismatch

Observed `https://crm.xopure.com` healthy but loading no dashboard experience.

Root causes:

- The frontend-only Railway image copied a current Vite build, then overwrote its
  generated `index.html` with a stale branded file pointing at old hashed assets.
- The runtime remained `twentycrm/twenty:v0.32.0`, so the fork's dashboard and
  page-layout backend modules were not deployed.
- The public XO Pure workspace schema had no `dashboard` table. A separate
  Railway Postgres service contained a different workspace with one dashboard.
- The public CRM mirror contained `68` ambassadors but `0` products, `0`
  periods, `0` customers, and `0` XO orders, leaving CRM-native dashboard cards
  without source records.
- The public Postgres service had only `36` core migrations and `39` metadata
  migrations. Deploying the fork is a real schema upgrade, not a frontend-only
  release.
- The worker and backup services resolved their Dockerfiles from the repository
  root, but both configs pointed at a bare `Dockerfile`. Their latest Railway
  deployments failed before the services could run.
- The backup service used `postgres:16-alpine` against PostgreSQL 18.3 and could
  not produce a compatible dump. Its Dockerfile also copied `backup.sh` from the
  wrong root-relative path.
- A one-shot PostgreSQL 18 backup probe reached Cloudflare R2 but failed before
  upload because Railway's `R2_ACCESS_KEY_ID` has length `10`; R2 requires a
  `32`-character access key. The hourly cron is restored but remains blocked
  until that Railway variable is replaced with the real R2 credential.
- The Supabase-to-Twenty bridge had drifted from the live read-only Supabase
  schema (`products.slug`, `products.cv_amount`, and `orders.updated_at` were
  among the stale reads). Live Supabase also has no `public.crm_sync_map`; that
  compatibility lookup must remain optional.

Current build path:

- Root `railway.toml` builds `packages/twenty-docker/twenty/Dockerfile`.
- The final `railway` target ships the matching fork backend and frontend,
  preserves Vite's generated entrypoint, and overlays XO Pure branding assets.
- Deploy the web service only after verifying a PostgreSQL 18 backup. After
  migrations, run `xopure:sync-standard-application` to backfill Dashboards into
  existing workspaces, then deploy the matching worker.
- The corrected bridge completes in `DRY_RUN=1` mode and plans `5` products,
  `109` ambassadors, `13` customer profiles, `1` period, and `68` orders for the
  XO Pure mirror.

Local command warning:

- `packages/twenty-server/src/database/typeorm/core/core.datasource.ts` loads
  `packages/twenty-server/.env` with `override: true` when an Nx command runs
  from that package directory. A local `nx ... command-no-deps` invocation can
  silently target the local development Postgres even when the shell exports a
  Railway URL. Do not use that path for production backfills. Verify the target
  database explicitly and run the post-migration backfill from the deployed
  fork environment.
