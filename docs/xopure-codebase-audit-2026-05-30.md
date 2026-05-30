# XO Pure CRM Codebase Audit - 2026-05-30

## Governing Rules

- Supabase is an absolute read-only source. Codex and repository workflows must never mutate
  Supabase data, schema, functions, or policies.
- `XO_Pure_Comp_Plan - Final.pdf` is the ambassador compensation authority, with one approved
  correction: eligible balances above `$10` are disbursed weekly. See
  `docs/xopure-ambassador-comp-plan-rules.md`.
- Proposed Supabase changes remain local review artifacts. They are not deployment instructions.

## Repository Shape

The git root is the nested `Xopure_crm/` directory inside
`/Users/brians/Documents/xopure_crm`. It is a fork of Twenty CRM organized as an Nx monorepo
with Yarn `4.13.0`.

| Area | Primary location | Role |
|---|---|---|
| Web client | `packages/twenty-front` | React dashboard and CRM UI |
| API/server | `packages/twenty-server` | NestJS, GraphQL, TypeORM, workspace metadata |
| Shared packages | `packages/twenty-shared`, `packages/twenty-ui` | Types, utilities, design system |
| XO Pure app | `packages/twenty-apps/internal/xopure-crm` | XO Pure objects, fields, agents, webhook stub |
| CRM setup | `scripts/xopure/setup-custom-objects` | Local Twenty metadata provisioning scripts |
| Data sync | `scripts/xopure/sync-supabase-to-twenty` | Reads Supabase and writes the Twenty CRM mirror |
| Local schema artifacts | `supabase/migrations` | Historical/proposed Supabase SQL; never auto-apply |
| Deployment overlays | `services/server`, Railway config | Server, worker, backup deployment assets |

## Runtime And Dependencies

The front end uses React 18, TypeScript, Jotai, Linaria, Apollo, Lingui, Vite, and Nivo chart
packages. The server uses NestJS, GraphQL Yoga, TypeORM, PostgreSQL, Redis, and BullMQ.

The root package requires Node `^24.5.0`. The audited shell currently has Node `v20.19.5`.
Repository-root dependencies are not installed: neither `node_modules` nor `.pnp.cjs` exists.
Yarn package-backed formatter, Jest, and typecheck commands therefore cannot run in this
checkout until the correct Node version and install state are restored.

## Data Architecture

Supabase is the source of truth. XO Pure PostgreSQL is the CRM mirror used by CRM-native
dashboard cards. Dashboard templates create Twenty `Dashboard` records and page-layout widgets;
they do not write Supabase.

The sync script is now fail-closed for Supabase writes:

- REST calls reject every method except `GET`.
- Direct Supabase PostgreSQL connections request `default_transaction_read_only=on`.
- Existing `public.crm_sync_map` rows can be read for compatibility.
- New `crm_sync_map` writes are skipped. Durable sync bookkeeping should move into Twenty.

Twenty-side CRM writes remain intentional: the mirror must be populated for native CRM cards.

## Dashboard State

Twenty already provides Dashboard records, auto-provisioned page layouts, drag-resize grids,
record-table widgets, front-component widgets, and graph widgets.

The XO Pure template layer now provides:

- Curated starter dashboards for Ambassador Growth, Customer 360, Revenue & Orders, and Live
  Operations.
- A Dashboard index-header modal for one-click template creation.
- Typed template serialization for bar, line, pie, aggregate, and gauge configurations.
- Metadata-safe card creation: cards with unresolved objects or required fields are skipped.
- Stable universal-identifier resolution for installed app front components.
- Phase 1 object alignment for `ambassador`, `customer`, and `xoOrder`.
- Three read-only Supabase front components included in Live Operations when their installed
  app components can be resolved: `LiveMetricCounter`, `LiveActivityFeed`, and
  `RealtimeRevenueLineChart`. They use an RLS-scoped anon key, perform reads only, and refresh
  after Realtime change notifications. Their visual colors, spacing, borders, and typography
  consume host-provided `twenty-sdk/ui` theme tokens for light/dark parity. Shared app-local
  state primitives provide themed loading skeletons and empty/error pills; live count and
  revenue totals interpolate on refresh.
- Dashboard templates provide deliberate half-width and full-width desktop positions. The host
  converts them into one-column mobile layouts through `convertPageLayoutToTabLayouts`.

Gauge support is incomplete upstream. The GraphQL configuration union, side-panel helpers, and
standalone component exist, but the dashboard router intentionally returns invalid config and
the persisted configuration has no goal/range fields. Gauge templates serialize correctly, but
starter dashboards do not include gauge cards until that contract is designed.

## Data Model Findings

There are two XO Pure CRM object models in the repository:

1. `scripts/xopure/setup-custom-objects/spec.mjs` provisions the Phase 1 mirror targeted by
   the current sync script:
   `product`, `period`, `ambassador`, `customer`, and `xoOrder`.
2. `packages/twenty-apps/internal/xopure-crm/src/objects` defines a newer app-scoped model:
   `xopureProduct`, `xopureAmbassador`, `xopureCustomer`, `xopureOrder`,
   `xopureOrderLine`, and `xopureCommission`.

These models should be consolidated before expanding live widgets or relying on app-scoped
commission cards. The current starter dashboards intentionally use the Phase 1 mirror because
the active sync script writes those Twenty tables.

## Compensation Drift Findings

Local Supabase migration artifacts predate the locked compensation rules. They include a `$50`
minimum payout and a `14`-day hold in historical defaults, while the governing rules require a
seven-day hold and weekly disbursement above `$10`. Older commission-model artifacts also need
a line-by-line review against the locked digest before any future implementation work.

No Supabase migration was applied and no Supabase data was mutated during this audit.

## Verification Completed

- Read the nine-page compensation PDF and recorded the corrected digest.
- Audited git state, monorepo structure, dependencies, XO Pure app, setup scripts, sync paths,
  dashboard architecture, and local Supabase artifacts.
- Ran `git diff --check`.
- Ran `node --check scripts/xopure/sync-supabase-to-twenty/index.mjs`.
- Ran `yarn lint` in `packages/twenty-apps/internal/xopure-crm`.
- Ran `yarn twenty typecheck` in `packages/twenty-apps/internal/xopure-crm`.
- Confirmed the new live components contain no fixed hex visual colors or `sans-serif`
  fallbacks.
- Attempted formatter execution; Yarn correctly failed because the checkout has no install
  state.
- Confirmed the XO Pure app test command currently exits with "No test files found".
- Did not run `yarn twenty build`: this SDK version documents that command as a server-syncing
  operation, and no running-instance sync was authorized during the local audit.

## Open Work

- Runtime smoke-test dashboard creation and the template-gallery modal.
- Restore Node `^24.5.0` plus repository dependencies and run focused tests/typecheck.
- Regenerate Lingui catalogs after the XO Pure source-copy sweep.
- Replace remaining upstream links after confirming XO Pure app, marketing, legal, docs,
  releases, GitHub, and hosted email-logo destinations.
- Confirm final XO Pure artwork for the existing deployment overlay.
- Move durable sync bookkeeping into Twenty rather than Supabase.
- Consolidate the two XO Pure CRM object models.
- Design the persisted gauge goal/range contract before enabling gauge cards in starter
  dashboards.
- Define reviewed map-ready coordinate/location fields and confirm RLS exposure before building
  `GeoSignupMap`.
