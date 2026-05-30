# XO Pure — Dashboards, Branding & Session Plan

> Complete, version-controlled record of the dashboard build-out, full "Twenty → XO Pure"
> UI rebrand, and longer login sessions. This is the source of truth for these workstreams.

- **Status:** Draft / approved for execution
- **Owner:** Brian
- **Last updated:** 2026-05-30
- **Scope:** `packages/twenty-front`, `packages/twenty-server`, `packages/twenty-emails`, `packages/twenty-apps`, branding assets, env config

---

## Operating laws

- [x] **Supabase is read-only from this repository and from Codex. Never write to the
      Supabase database.** Do not apply migrations, execute mutating SQL, invoke write RPCs,
      update rows, or run scripts in a mode that writes to Supabase. Reads are allowed for
      audits and verification only. Any proposed Supabase schema or data change must remain a
      local, reviewable artifact until Brian explicitly handles deployment outside this workflow.
- [x] **Ambassador compensation authority locked:** `XO_Pure_Comp_Plan - Final.pdf`
      (rules locked 2026-05-24) is the governing business source. The one approved correction
      is that eligible balances above `$10` are disbursed weekly. Treat the page-6 `$50`
      minimum-payout row as superseded by this correction and by the Friday-sweep flow on
      page 9.
- [x] **Compensation implementation guardrail:** dashboards, CRM objects, sync mappings, local
      SQL proposals, and future commission-engine work must align with the locked rules digest
      in `docs/xopure-ambassador-comp-plan-rules.md`.

---

## Audit milestone — 2026-05-30

- [x] Audited the nested repository root, current git state, package structure, Nx/Yarn
      workspace configuration, deployment overlays, XO Pure scripts, Supabase migration
      artifacts, and the existing XO Pure Twenty app.
- [x] Confirmed architecture: upstream Twenty CRM fork with React 18 + Jotai + Linaria front
      end, NestJS + TypeORM + GraphQL back end, PostgreSQL + Redis services, Railway
      deployment overlays, and a read-only Supabase-to-Twenty sync path.
- [x] Audited the full nine-page ambassador compensation PDF and recorded the corrected,
      governing implementation rules.
- [x] Confirmed the existing dashboard-template work is local and uncommitted. The current
      builder supports bar graphs, record tables, and front components; the next implementation
      milestone is complete visualization coverage plus a visible gallery entry point.
- [x] Confirmed local verification constraints: repository-root dependencies are not installed
      and the current shell is Node `v20.19.5`, while the monorepo requires Node `^24.5.0`.
- [x] Found and removed Supabase `crm_sync_map` mutation paths from the sync script. REST now
      rejects non-`GET` requests, direct Supabase PostgreSQL connections request
      `default_transaction_read_only=on`, and compatibility map writes are skipped.
- [x] Recorded the full architecture, dependency, data-model, drift, and risk audit in
      `docs/xopure-codebase-audit-2026-05-30.md`.

## Continuation milestone — 2026-05-30

- [x] Reconciled the current dirty worktree and preserved the concurrent
      `docs/xopure-dashboard-widget-ideas.md` backlog without modifying it.
- [x] Reconfirmed the non-negotiable Supabase read-only law before continuing:
      no database writes, mutating REST calls, migrations, or write-capable
      verification paths.
- [x] Re-ran the locally available widget validation path: XO Pure app lint,
      XO Pure app typecheck, diff whitespace check, sync script syntax check,
      fixed-color scan, and Supabase mutation-pattern scan are clean.
- [x] Confirmed the repository requires Node `24.5.0`; the runtime is not
      installed locally and repository-root dependencies are not restored yet.
- [x] Installed the required Node `24.5.0` runtime locally.
- [x] Cleared Yarn's disposable global package cache after the first immutable
      install exposed local disk pressure, raising free space from `3.4 GiB`
      to `9.8 GiB` without touching source files.
- [ ] Restore repository-root dependencies, regenerate Lingui catalogs, and
      run the focused root-level validation suite.

---

## 0. Context & key findings

XO Pure CRM is a fork of the open-source Twenty CRM (Nx monorepo, React 18 + Jotai + Linaria
front end, NestJS + TypeORM + GraphQL back end). The instance is designed for **read-only
processes from Supabase** today, with **agentic workflows** planned for the future. This plan
sets the foundation.

### 0.1 Branch comparison (`main` vs `origin/dev`)

A full diff was performed. **The dashboard / widget / page-layout code is byte-identical
between `main` and `origin/dev`.**

- `git diff --stat main origin/dev` over every `*dashboard*`, `*page-layout*`, `*widget*`
  path returns **zero code changes** (only a deleted screenshot asset).
- Commits unique to `dev` concern **Supabase→Twenty sync, an app-factory orchestrator, and
  ambassador access controls** — not dashboards.

**Conclusion:** the "generate dashboards with widget cards" capability is **not** unique to
`dev`. It is a mature upstream Twenty feature present in **both** branches. The page view
simply hasn't been surfaced/created in the running instance yet. Nothing dashboard-related
needs to be pulled from `dev`.

### 0.2 What already exists — the "widget card page system"

The system is the `page-layout` module powering a first-class `Dashboard` core object.

| Capability | Location |
|---|---|
| `Dashboard` core object (holds `pageLayoutId`) | `packages/twenty-server/src/modules/dashboard/standard-objects/dashboard.workspace-entity.ts` |
| Auto-provision page layout on dashboard create | `packages/twenty-server/src/modules/dashboard/query-hooks/dashboard-create-one.pre-query.hook.ts` |
| Widget content router (all widget types) | `packages/twenty-front/src/modules/page-layout/widgets/components/WidgetContentRenderer.tsx` |
| Chart engine (bar/line/pie/aggregate/**gauge** — gauge now wired to its renderer) | `packages/twenty-front/src/modules/page-layout/widgets/graph/` |
| Chart data aggregation (back end) | `packages/twenty-server/src/modules/dashboard/chart-data/` |
| Add-widget side panel UX | `packages/twenty-front/src/modules/side-panel/pages/page-layout/components/SidePanelPageLayoutDashboardWidgetTypeSelect.tsx` |
| Edit-mode / drag-resize grid state | `packages/twenty-front/src/modules/page-layout/hooks/useSetIsPageLayoutInEditMode.ts` |
| Duplicate dashboard (seed of "templates") | `packages/twenty-front/src/modules/dashboards/hooks/useDuplicateDashboard.ts` |
| Custom React widgets (sandboxed) | `packages/twenty-front/src/modules/page-layout/widgets/front-component/components/FrontComponentWidgetRenderer.tsx` |
| Front-component host API (navigate, modals, snackbars, progress) | `packages/twenty-front/src/modules/front-components/hooks/useFrontComponentExecutionContext.ts` |

Supported `WidgetType` values (`packages/twenty-front/src/generated-metadata/graphql.ts`):
`GRAPH`, `RECORD_TABLE`, `IFRAME`, `FRONT_COMPONENT`, `STANDALONE_RICH_TEXT`, `FIELD`,
`FIELDS`, `FIELD_RICH_TEXT`, `FILES`, `TIMELINE`, `NOTES`, `TASKS`, `CALENDAR`, `EMAILS`,
`EMAIL_THREAD`, `VIEW`, `WORKFLOW`, `WORKFLOW_RUN`, `WORKFLOW_VERSION`.

### 0.3 The real gaps worth building

1. **No template/gallery system.** Dashboards are created blank; `useDuplicateDashboard`
   exists but there is no curated one-click "spin up this dashboard" flow.
2. **No real-time refresh.** Charts fetch aggregates on load; nothing is event-driven.
3. **Supabase data is not yet a widget data source.**
4. **Gauge rendering — router fixed 2026-05-30.** The central graph router previously sent
   `GAUGE_CHART` configs to an invalid-config display. A `GraphWidgetGaugeChartRenderer`
   (modeled on the aggregate renderer) now fetches the aggregate value and renders the
   existing `GraphWidgetGaugeChart`. Because the persisted `GaugeChartConfiguration` still has
   **no goal/range/max field**, the upper bound is **derived** from the value
   (`deriveGaugeMax`). The remaining gap is a real persisted `min/max/goal` model — see A1d.

### 0.4 Architecture decisions (approved)

- **Templates: hybrid** — code-defined template definitions (version-controlled) that are
  materialized into data-driven `Dashboard` records flagged `isTemplate`, then cloned via the
  existing duplicate flow + a gallery UI.
- **Real-time: Supabase Realtime** — live, event-driven visuals streamed from Supabase into
  custom `FRONT_COMPONENT` widgets (XO Pure's source of truth is Supabase, read-only).

---

## 1. Architecture at a glance

```
Supabase (read-only source of truth)
   │  Realtime channels / Postgres changes (anon key + RLS)
   ▼
FRONT_COMPONENT widget  ──┐
                          ├─►  Dashboard (core object) ── pageLayoutId ──► PageLayout ──► Tabs ──► Widgets
GRAPH / RECORD_TABLE  ────┘                                                                         (grid: drag/resize)
   ▲
   │ CRM aggregates (bar/line/pie/gauge/aggregate resolvers)
XO Pure Postgres (synced subset of Supabase)
```

Two deliberate data planes:

- **CRM-native widgets** (`GRAPH`, `RECORD_TABLE`) — use the built-in chart engine over data
  already synced into XO Pure Postgres. Zero new infrastructure.
- **Live widgets** (`FRONT_COMPONENT`) — sandboxed React apps that subscribe to **Supabase
  Realtime** for genuine push updates.

---

## 2. Workstream A — Dashboards

### Phase A0 — Enable & verify (0.5 day)

- [ ] Confirm feature flags on the active workspace:
      `IS_RECORD_PAGE_LAYOUT_EDITING_ENABLED` and
      `IS_RECORD_PAGE_LAYOUT_GLOBAL_EDITION_ENABLED`
      (`packages/twenty-server/src/engine/workspace-manager/workspace-migration/constant/default-feature-flags.ts`).
      Default-on for new workspaces; verify the existing workspace has them.
- [x] Confirm the `Dashboard` object is active in navigation *(Verified in code 2026-05-30: `Dashboard` is a registered standard object — standard id `00000000-0000-0000-0000-000000000295`, default `allDashboards` view, `IconLayoutDashboard` nav icon. It appears in navigation by default.)*
- [ ] **ACTION REQUIRED (Brian):** Runtime smoke test — create a Dashboard record → confirm a page layout auto-provisions → enter edit mode → add a bar chart over an existing object → save. (Requires the running instance; verifies the existing workspace has the flags enabled.)

**Outcome:** confirmed in code this is a "view not surfaced yet" situation (expected), not a bug. Dashboards are a fully-built upstream feature present in both branches.

### Phase A1 — Template engine (hybrid) (2–3 days)

**A1a. Code-defined template definitions** — DONE 2026-05-30
- [x] New module `packages/twenty-front/src/modules/dashboards/templates/`.
- [x] Typed template definitions: `types/DashboardTemplate.ts` (`DashboardTemplate`,
      `DashboardTabTemplate`, discriminated `DashboardWidgetTemplate` for graph / recordTable /
      frontComponent). Objects referenced by `nameSingular`, fields by name.
- [x] Starter set in `constants/DashboardTemplates.ts`: **Ambassador Growth**, **Customer 360**,
      **Revenue & Orders**, **Live Operations**.

**A1b. Instantiation engine (chosen over a DB `isTemplate` field for v1)** — DONE 2026-05-30
- [x] Pure builder `utils/buildDraftPageLayoutFromTemplate.ts` — converts a template into a
      `DraftPageLayout` using the existing `createDefault*Widget` builders. Widgets whose object
      cannot be resolved in the current workspace are **skipped gracefully** (no broken widgets).
- [x] Front-component template references may use stable universal identifiers; the
      orchestration hook resolves installed workspace component ids and skips unavailable app
      components gracefully.
- [x] Orchestration hook `hooks/useInstantiateDashboardTemplate.ts` — creates a `Dashboard`
      record (auto-provisions a page layout), resolves object/field metadata ids by name, builds
      the draft, persists via `updatePageLayoutWithTabsAndWidgets`, and navigates to the new
      dashboard. Reuses fully-working persistence; no schema change required.
- [x] Unit test `utils/__tests__/buildDraftPageLayoutFromTemplate.test.ts`.
- Note: A data-driven `isTemplate` DB field + duplicate-based gallery remains a **future option**
  (B-route). The code-defined engine ships first because it needs no migration and is reviewable.

**A1c. Template gallery UI** — IN PROGRESS
- [x] `components/DashboardTemplateGallery.tsx` — themed card grid; selecting a card calls
      `instantiateDashboardTemplate` and shows pending state.
- [x] Mount the gallery behind a Dashboard index header button so templates are discoverable
      without adding a new route or changing the generic create-record flow.
- [x] Wire the chosen entry point.
- [ ] Verify end-to-end in the running app.

**A1d. Visualization-complete templates** — DONE 2026-05-30
- [x] Extend graph templates beyond the default bar chart to support bar, line, pie,
      aggregate, and gauge configurations.
- [x] Add focused builder tests for every visualization configuration and skip graphs when
      required field metadata cannot be resolved.
- [x] Align starter dashboards to the Phase 1 CRM object model (`ambassador`, `customer`,
      `xoOrder`) and provide aggregate, trend, breakdown, and record-table cards.
- [x] **Gauge router wired (2026-05-30):** `GraphWidget.tsx` now routes `GAUGE_CHART` to a new
      `GraphWidgetGaugeChartRenderer`; gauge cards added manually render instead of showing the
      invalid-config box. Max is derived via `deriveGaugeMax` (unit-tested).
- [ ] **Gauge follow-up (remaining):** add a persisted `min/max/goal` model to the
      `GaugeChartConfiguration` DTO + GraphQL (regen types) and expose it in the chart picker.
      Until then, curated starter templates intentionally **avoid** gauge cards because a
      derived max is approximate and could mislead; serialization already supports `'gauge'`.

**A1e. Flagship admin templates** — DONE 2026-05-30
*(Designs: [`xopure-admin-and-portal-dashboards.md`](./xopure-admin-and-portal-dashboards.md);
cards: [`xopure-dashboard-widget-ideas.md`](./xopure-dashboard-widget-ideas.md).)*
- [x] **Admin · Mission Control I — Growth & Revenue** (12 native cards): KPI row, revenue/orders
      trends, status & acquisition breakdowns, AOV, payment-method mix, top-ambassador and recent-
      orders tables.
- [x] **Admin · Mission Control II — Compensation & Network** (2 tabs, 20 cards): period payouts &
      payout-% trend, rank/tier distribution, lifetime comp; ambassador path/rank/elite/status mix.
- [x] **Compliance & Risk Command** (11 cards): fraud-score aggregate + **gauge**, fraud-flagged /
      self-referral / payment-method / status shares, orders table.
- [x] **Recruiting & Onboarding** (10 cards): ambassador & customer acquisition trends, onboarding-
      stage funnel (as bar), acquisition-source and path mix.
- [x] **Product Performance** (11 cards): catalog mix by category/format, pricing & CV, active /
      commission-eligible shares, units sold.
- [x] Enriched the three thin starter templates to full native dashboards (Ambassador Growth
      4→12 cards, Customer 360 4→9, Revenue & Orders 4→11).
- [x] **103 native cards across nine templates**, all surfaced automatically in the gallery;
      builder unit test asserts every shipped template resolves all cards against the deployed model.
- [ ] Verify the admin templates end-to-end in the running app (create from gallery → cards render).
- [ ] Pending portal templates *Ambassador · My Business* and *Customer · My XO Pure* (after D2).

### Phase A1 verification notes

- [x] `git diff --check`
- [x] `node --check scripts/xopure/sync-supabase-to-twenty/index.mjs`
- [x] `yarn lint` in `packages/twenty-apps/internal/xopure-crm`
- [x] `yarn twenty typecheck` in `packages/twenty-apps/internal/xopure-crm`
- [ ] Run focused Jest, TypeScript, and formatter checks after installing repository-root
      dependencies under the required Node `^24.5.0`. Current checkout has neither
      `node_modules` nor `.pnp.cjs`, so `yarn exec prettier --check ...` cannot resolve packages.

### Phase A2 — Supabase Realtime live widgets (3–5 days)

- [x] Build the first front component in `packages/twenty-apps/internal/xopure-crm` (Twenty SDK
      app model); it bundles to a sandboxed component rendered by `FrontComponentRenderer.tsx`.
- [x] Add `LiveMetricCounter`: perform an RLS-scoped anon-key `SELECT count` against an
      allowlisted table (`orders`, `affiliates`, or `customers`) and refresh after read-only
      Supabase Realtime Postgres-change notifications.
- [x] Add XO Pure app variables for the Supabase URL, RLS-scoped anon key, and allowlisted live
      metric table. Explicitly prohibit service-role keys in the front component.
- [x] Add the installed `LiveMetricCounter` to the **Live Operations** starter template through
      its stable universal identifier; skip the card when the app component is unavailable.
- [ ] Runtime app sync/install + variable configuration in the running Twenty instance.
- [x] Add `LiveActivityFeed`: read the six newest orders and refresh after read-only Realtime
      notifications.
- [x] Add `RealtimeRevenueLineChart`: read the newest 20 order totals, render a lightweight SVG
      trend, and refresh after read-only Realtime notifications.
- [ ] Add `GeoSignupMap` after defining a reviewed source field contract for coordinates or
      geocoded locations and confirming the RLS exposure is appropriate. Current source data
      does not provide a stable map-ready contract.
- [ ] **Security runtime verification:** confirm the configured anon key is RLS-scoped and
      read-only before installing the live card. Never embed service-role keys client-side.

### Phase A3 — Visual polish ("flawless" layer) (2 days)

- [x] All custom live widgets consume host-provided `twenty-sdk/ui` theme tokens — no
      hardcoded visual colors (light/dark parity).
- [x] Add themed skeleton loaders, consistent empty/error status pills, subtle SDK entrance
      animation, and number-tick interpolation on live count and revenue values. The sandboxed
      app uses a local state component because host-internal `PageLayoutWidgetNoDataDisplay`
      is not exported through `twenty-sdk/ui`.
- [x] Bake intentional half-width and full-width desktop grid presets into templates. The host
      converts those layouts to single-column mobile cards automatically.

### Phase A4 — Agentic foundation (scoping only)

- The `FRONT_COMPONENT` host API already exposes `navigate`,
  `openCommandConfirmationModal`, `updateProgress`, `enqueueSnackbar` — an "agent" widget can
  drive the UI through it.
- Pair with `WORKFLOW` widgets so a dashboard can both **display** metrics and **trigger**
  workflows/agents from the same card.

---

## 3. Workstream B — Rebrand "Twenty" → "XO Pure" (no Twenty anywhere in the UI)

**Goal:** zero user-visible references to "Twenty" / "Twenty CRM". Internal package names,
import paths, and code identifiers (`twenty-front`, `twenty-ui`, `twenty-shared`,
`twenty-config`, GraphQL type names, etc.) are **NOT** renamed — doing so would break the
build. This workstream targets **user-facing strings and assets only**.

### B.1 Scope reality

A scan found ~6,600 occurrences of "Twenty" across ~3,500 files in `twenty-front/src` alone.
The overwhelming majority are **not** user-facing (test fixtures, mock data, `twenty.com`
sample emails, import paths, internal identifiers). The rebrand is therefore a **targeted,
categorized sweep**, not a blind global replace.

Note: `packages/twenty-front/index.html` already uses `<title>XO Pure CRM</title>` — partial
rebrand has begun.

### B.2 Do-NOT-touch list (would break the app)

- Package/dir names: `twenty-front`, `twenty-server`, `twenty-ui`, `twenty-shared`,
  `twenty-emails`, `twenty-apps`, `twenty-config`, etc.
- Import paths and module aliases (`@/...`, `twenty-shared/...`).
- GraphQL type/enum names, DB schema/table/column names, metadata identifiers.
- Service/class names (`TwentyConfigService`, `twenty-env-config`, etc.).
- Test fixtures and mock data using `@twenty.com` emails (cosmetic, non-UI — optional later).

### B.3 Targeted user-facing locations (high priority)

| Area | File(s) | Status |
|---|---|---|
| Browser tab title | `packages/twenty-front/index.html` (`<title>XO Pure CRM</title>`) | [x] Done (pre-existing) |
| Auth landing copy ("Welcome to Twenty") | `packages/twenty-front/src/pages/auth/SignInUp.tsx` | [x] Done 2026-05-30 → "Welcome to XO Pure" |
| Sign-in/up footer note | `packages/twenty-front/src/modules/auth/sign-in-up/components/FooterNote.tsx` | [x] Done 2026-05-30 → "By using XO Pure…" |
| Onboarding email sync copy | `packages/twenty-front/src/pages/onboarding/SyncEmails.tsx` | [x] Done 2026-05-30 |
| Page titles | `packages/twenty-front/src/modules/ui/utilities/page-title/components/PageTitle.tsx`, `NotFound.tsx` | [x] Default already uses `XO Pure CRM`; corrected the 404 title |
| Other onboarding flows | `packages/twenty-front/src/pages/onboarding/*` | [x] Source sweep complete; no remaining user-facing `Twenty` copy |
| OAuth / authorize screen | `packages/twenty-front/src/pages/auth/Authorize.tsx` | [x] Replace hardcoded Twenty SVG with existing XO Pure launcher icon |
| Compiled UI catalog (Lingui) | `packages/twenty-front/src/locales/generated/en.ts` and other locales | [ ] Regenerate after source-string sweep |
| Email templates | `packages/twenty-emails/` | [x] Source copy sweep complete; catalog regeneration and external URL pass remain open |
| Legal link `href`s (twenty.com/legal/*) | `FooterNote.tsx` and others | [ ] Repoint to XO Pure legal URLs (not visible text, but shows on hover) |
| Branding assets (logos, favicon, manifest, icons) | `services/server/branding/`, email `Logo.tsx` | [ ] XO Pure overlay is present; confirm final artwork and add a hosted XO Pure email-logo URL |
| Miscellaneous visible UI copy | 404, billing errors, spreadsheet import, application description, settings examples | [x] Source sweep complete |

**Verification note:** This workspace's TypeScript server / dependencies are not fully
resolved in the current environment (every module, incl. `react`, reports "cannot find"), so
`typecheck`/`jest`/`storybook` could not be run here. All edits were text-only replacements
inside existing strings and were reviewed manually. Run `npx nx typecheck twenty-front` and the
Storybook spot-check on a fully-installed environment before deploy.

### B.4 Execution strategy

1. **Inventory:** generate a categorized report of user-facing "Twenty" strings
   (JSX text, `t\`...\`` templates, labels/titles, email subjects/bodies). Exclude the
   do-not-touch list via path/extension filters.
2. **i18n-first:** because most UI text flows through Lingui (`t\`\``, `<Trans>`), update
   source strings, then regenerate catalogs. Centralize the product name in a single constant
   (e.g. `APP_NAME = 'XO Pure'`) where strings are interpolated, to avoid future drift.
3. **Scripted, reviewable sweep:** apply replacements file-category by file-category with a
   diff review at each step (auth → onboarding → titles → emails → misc settings copy).
4. **Assets:** replace logos / favicon / manifest / app icons under `services/server/branding/`
   with XO Pure artwork; confirm Docker/Railway branding overlay still applies.
5. **Verification:**
   - `grep -ri "twenty" packages/twenty-front/src --include=*.tsx` filtered to display strings → expect zero user-facing hits.
   - Manual pass: login, onboarding, page titles, command menu, settings, emails.
   - `npx nx storybook:build twenty-front` visual spot-check of auth/onboarding.

### B.5 Acceptance criteria

- [ ] No "Twenty" / "Twenty CRM" visible anywhere a user can reach in the UI.
- [ ] Browser tab title, auth, onboarding, emails all read "XO Pure".
- [ ] Logos / favicon / manifest are XO Pure branded.
- [ ] App builds and type-checks (`npx nx typecheck twenty-front`); internal identifiers untouched.

---

## 4. Workstream C — Longer login sessions

**Goal:** stop frequent re-logins. All token durations are **env-configurable** via
`config-variables.ts` (`packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`),
so this is a configuration change — **no code change required**.

### C.1 Current defaults

| Variable | Default | Effect |
|---|---|---|
| `ACCESS_TOKEN_EXPIRES_IN` | `30m` | Short-lived API token; auto-refreshed silently. |
| `REFRESH_TOKEN_EXPIRES_IN` | `60d` | **How long until a true re-login is required.** |
| `WORKSPACE_AGNOSTIC_TOKEN_EXPIRES_IN` | `30m` | Pre-workspace-selection token. |
| `LOGIN_TOKEN_EXPIRES_IN` | `15m` | One-time login handoff window. |
| `SHORT_TERM_TOKEN_EXPIRES_IN` | `5m` | Sensitive-action confirmation token. |
| `APPLICATION_ACCESS_TOKEN_EXPIRES_IN` | `30m` | OAuth app access token. |
| `APPLICATION_REFRESH_TOKEN_EXPIRES_IN` | `60d` | OAuth app refresh token. |

### C.2 Recommended values (set in `.env` / Railway)

```env
# Longer day-to-day session before silent refresh
ACCESS_TOKEN_EXPIRES_IN=7d
WORKSPACE_AGNOSTIC_TOKEN_EXPIRES_IN=7d

# Long-lived "stay signed in" window before a real re-login
REFRESH_TOKEN_EXPIRES_IN=180d
```

- [x] Add the above to `.env` and `.env.xopure.example` (document them). *(Done 2026-05-30: `ACCESS_TOKEN_EXPIRES_IN=7d`, `REFRESH_TOKEN_EXPIRES_IN=180d` added to both; `WORKSPACE_AGNOSTIC_TOKEN_EXPIRES_IN` was already `3650d` in `.env`.)*
- [ ] **ACTION REQUIRED (Brian):** Set `ACCESS_TOKEN_EXPIRES_IN=7d` and `REFRESH_TOKEN_EXPIRES_IN=180d` in the **Railway dashboard** env vars (production runs from Railway; `railway.toml` holds build/deploy config only, not env vars).
- [ ] Restart server; verify a session survives well past 30 minutes idle and that re-login is
      no longer prompted within the new window.

### C.3 Notes & trade-offs

- Longer-lived tokens are a security/convenience trade-off. `7d` access + `180d` refresh is a
  reasonable balance for an internal team tool. Increase `REFRESH_TOKEN_EXPIRES_IN` further
  (e.g. `365d`) if desired.
- Leave `LOGIN_TOKEN_EXPIRES_IN`, `SHORT_TERM_TOKEN_EXPIRES_IN`, and
  `PASSWORD_RESET_TOKEN_EXPIRES_IN` short — they protect sensitive handoffs and should not be
  extended.
- If re-logins persist despite a long refresh window, investigate front-end silent-refresh /
  refresh-token rotation rather than extending durations further.

---

## 4.5 Workstream D — External portals (ambassador & customer facing)

> Full design: [`xopure-admin-and-portal-dashboards.md`](./xopure-admin-and-portal-dashboards.md).

**Goal:** surface **self-scoped** dashboards to end users handed off from **xopure.com** — an
ambassador sees only their own book, downline, and commissions; a customer sees only their own
account — without a second login, and **read-only** against Supabase under RLS.

- **Admin "Mission Control"** (internal, two pages: *Growth & Revenue* and *Comp, Risk & Network*)
  is the global command center; Page I ships almost entirely on the native engine today.
- **Ambassador "My Business"** and **Customer "My XO Pure"** are row-scoped portals built from
  `FRONT_COMPONENT` widgets reading Supabase under **RLS keyed to the authenticated identity**
  (anon key only; standing read-only law).

**Portal phases (D1–D5):**
- [ ] **D1 — Identity bridge:** xopure.com (Supabase Auth) → portal token hand-off; RLS claim
      mapping (`ambassadorId` / `customerId`). No service-role key client-side; read-only only.
- [ ] **D2 — Self-scoped data layer:** authenticated Supabase client + scoped widget data hooks.
- [ ] **D3 — Ambassador portal:** "My Business" dashboard gated to `ambassadorId`.
- [ ] **D4 — Customer portal:** "My XO Pure" dashboard gated to `customerId`.
- [ ] **D5 — Polish & surface:** branding, standalone portal app vs embed decision, responsive.

**Engine upgrades these surfaces promote to first-class A-phase items** (each unlocks many admin
cards too): gauge goal/range model, group-by on a relation field, bucketed histogram, and the
leaderboard / funnel / downline-tree primitives. **Comp-engine derived data (🟠)** — held/payable
balances, Friday-sweep eligibility (`> $10`), milestone tracking — must be derived read-only from
Supabase (or computed in the Twenty mirror) before the compensation and ambassador-earnings cards
are real.

**Expanded A1 template roster** (see the design doc §5): the **five admin templates are now
scaffolded in code** (2026-05-30) — *Admin Mission Control I — Growth & Revenue*,
*Admin Mission Control II — Compensation & Network*, *Compliance & Risk Command*,
*Recruiting & Onboarding*, and *Product Performance* — all 100% native and gallery-discoverable,
joining the original four for **nine templates total**. A builder unit test asserts every shipped
template resolves all its cards against the deployed object model. Still pending: the self-scoped
portal templates *Ambassador · My Business* and *Customer · My XO Pure* (after D2), plus backfilling
🟡/🟠 cards (relation group-by, held/payable, fraud histogram) as the engine/comp-data upgrades land.

---

## 5. Sequencing & recommended start

1. **C — Sessions** (fastest win, env-only). Immediate quality-of-life improvement.
2. **A0 + A1 — Dashboards enable + templates** (visible value, zero new infra).
3. **B — Rebrand** (can run in parallel; mostly mechanical + asset swap).
4. **A2 — Supabase Realtime widgets** (highest impact; needs anon-key/RLS decision + app build).
5. **A3 — Polish**, then **A4 — agentic** scoping.

---

## 6. Open questions / decisions pending

- [ ] Supabase anon key + RLS policies for read-only Realtime access — confirm tables/channels.
- [ ] Final `REFRESH_TOKEN_EXPIRES_IN` value (180d vs 365d).
- [ ] XO Pure brand assets (logo SVG, favicon, app icons) — source files needed for B.4.
- [ ] XO Pure public destinations — app base URL, marketing site, legal terms/privacy, docs,
      GitHub, releases, and hosted email-logo URL.
- [ ] Which template set ships first (default: Ambassador Growth).

## 7. Change log

- 2026-05-30 — Enriched the three thin starter templates to full native dashboards
  (Ambassador Growth 4→12 cards, Customer 360 4→9, Revenue & Orders 4→11) using the verified
  Phase-1 field set — **103 native cards across nine templates** now.
- 2026-05-30 — Scaffolded five native admin dashboard templates in `DashboardTemplates.ts`
  (Mission Control I & II, Compliance & Risk Command, Recruiting & Onboarding, Product
  Performance) — nine templates total, all gallery-discoverable. Added a builder unit test
  asserting every shipped template resolves all cards against the deployed object model.
- 2026-05-30 — Completed A3 live-widget polish: SDK theme tokens, shared themed
  loading/empty/error states, Realtime number interpolation, and responsive template review.
  Continued the rebrand with a source-copy sweep across 404, billing, import, app-description,
  settings-example, authorize, and email-template surfaces. External URLs and Lingui catalog
  regeneration remain open.
- 2026-05-30 — Added the card catalog (`xopure-dashboard-widget-ideas.md`) and the flagship
  dashboard designs (`xopure-admin-and-portal-dashboards.md`): two-page Admin "Mission Control",
  self-scoped Ambassador "My Business" and Customer "My XO Pure" portals, the xopure.com→portal
  identity hand-off, and an expanded eight-template roster. Added **Workstream D — External portals**.
- 2026-05-30 — Codified the Supabase read-only law in `CLAUDE.md` (durable, top-of-file).
  Fixed the gauge graph router: added `GraphWidgetGaugeChartRenderer` + `deriveGaugeMax`
  (unit-tested) and wired `GraphWidget.tsx` `GAUGE_CHART` → renderer. Restored the accidentally
  deleted `LICENSE`. Gitignored the comp-plan PDF and the personal `.code-workspace`. Committed
  dashboards/branding/sessions/sync work and pushed to `main`.
- 2026-05-30 — Locked Supabase read-only law; audited repository and compensation PDF;
  recorded corrected weekly `>$10` payout rule; started visualization-complete templates.
- 2026-05-30 — Initial plan created (dashboards + rebrand + sessions).
