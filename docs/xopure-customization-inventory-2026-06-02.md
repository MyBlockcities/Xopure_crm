# XO Pure Twenty Customization Inventory - 2026-06-02

This document records the current XO Pure-specific dashboard, widget, view, and
script surfaces in this Twenty fork.

## Executive Conclusion

- The three live Supabase cards are app `FRONT_COMPONENT` definitions.
- Dashboards are not front-components. They are page layouts containing native
  graph, record-table, and front-component widgets.
- Before this audit, `packages/twenty-apps/internal/xopure-crm` had no page
  layout. The app now defines an installed `XO Pure Mission Control` standalone
  page with 17 widgets and a navigation item.
- The current branch still contains a separate legacy dashboard implementation
  in `twenty-front`. Its nine templates create workspace `Dashboard` records and
  target the manual mirror objects `ambassador`, `customer`, `xoOrder`, `period`,
  and `product`.
- The app model uses different object names: `xopureAmbassador`,
  `xopureCustomer`, `xopureOrder`, `xopureOrderLine`, `xopureProduct`, and
  `xopureCommission`. The two models must not be treated as interchangeable.

## App-Owned Mission Control

Primary files:

- `packages/twenty-apps/internal/xopure-crm/src/page-layouts/xopure-mission-control.page-layout.ts`
- `packages/twenty-apps/internal/xopure-crm/src/navigation-menu-items/mission-control.navigation-menu-item.ts`
- `packages/twenty-front/src/pages/main-dashboard/MainDashboardRedirect.tsx`

The root route now prefers the installed app page layout and falls back to the
Dashboards object index when the app is absent.

| Tab | Widgets |
|---|---|
| Growth & Revenue | Live Supabase Order Count, CRM Revenue, Total Customers, Total Ambassadors, Realtime Revenue Trend, Orders Over Time, Orders by Status, Ambassador Level Mix, Latest XO Pure Orders |
| Operations | Live Order Activity, Commission Earned, Attributed Revenue, Customer Status Mix, Products by Status, Products by Category, Recent Ambassadors, Product Catalog |

## App Front-Components

Location: `packages/twenty-apps/internal/xopure-crm/src/front-components`

| Component | Source |
|---|---|
| `xopure-live-metric-counter` | Read-only count against the allowlisted Supabase table configured by `XOPURE_LIVE_METRIC_TABLE` |
| `xopure-live-activity-feed` | Read-only order activity from Supabase `orders` |
| `xopure-realtime-revenue-line-chart` | Read-only revenue trend from Supabase `orders` |

All three use `XOPURE_SUPABASE_URL` and `XOPURE_SUPABASE_ANON_KEY`, subscribe to
Supabase Realtime, and are intended to rely on RLS-scoped read access.

## App Objects, Views, And Logic

App object definitions:

- `xopureAmbassador`
- `xopureCustomer`
- `xopureOrder`
- `xopureOrderLine`
- `xopureProduct`
- `xopureCommission`
- `retailProspect`
- `influencerProspect`
- `emailSequence`
- `automationTrigger`
- `enrichmentTask`

App views:

- Ambassador Levels
- Commission Pipeline
- Customer Command Center
- Influencer Prospecting
- Synced Order Lines
- Synced Orders
- Synced Products
- Retail Prospecting

Additional app surfaces:

- Two agents: XO Pure research and sequence agents
- Two skills: contact enrichment and sequence strategy
- Two logic functions: Supabase sync webhook and enrichment task creation
- Object navigation items plus the Mission Control page-layout navigation item
- Application variables for webhook secret, enrichment provider, Supabase URL,
  Supabase anon key, and live metric table

## Legacy Frontend Dashboard Templates

Location: `packages/twenty-front/src/modules/dashboards/templates`

These templates are code-defined blueprints that become workspace `Dashboard`
records and `PageLayout` metadata when instantiated. They are not app page
layouts and they are not front-components.

| Template | Cards |
|---|---:|
| Ambassador Growth | 12 |
| Customer 360 | 9 |
| Revenue & Orders | 11 |
| Live Operations | 7 |
| Admin Mission Control I - Growth & Revenue | 12 |
| Admin Mission Control II - Compensation & Network | 20 |
| Compliance & Risk Command | 11 |
| Recruiting & Onboarding | 10 |
| Product Performance | 11 |
| **Total** | **103** |

Integration points:

- `DashboardTemplates.ts` contains the template registry.
- `DashboardTemplateGallery.tsx` and `DashboardTemplateGalleryModal.tsx` expose
  one-click creation.
- `RecordIndexPageHeader.tsx` mounts the gallery on the Dashboards index.
- `useInstantiateDashboardTemplate.ts` creates Dashboard records and persists
  page-layout widgets.
- `buildDraftPageLayoutFromTemplate.ts` resolves objects and fields and skips
  unresolved cards.
- `scripts/xopure/port-dashboards/index.mjs` performs a server-side materialization
  of the same templates for a running Twenty workspace.

Current limitation: `useInstantiateDashboardTemplate.ts` deliberately resolves
all front-component identifiers to `undefined`, and `port-dashboards/index.mjs`
also skips front-component widgets. The legacy Live Operations templates
therefore do not currently receive the app's three live cards.

## Custom Scripts

| Script | Purpose | Architecture note |
|---|---|---|
| `setup-xopure-crm.sh` | First-time Railway bootstrap and secret generation | Deployment helper |
| `scripts/xopure/check-supabase-env.sh` | Validates Supabase project references and read access | Read-only verification |
| `scripts/xopure/apply-supabase-sql.sh` | Executes arbitrary SQL through the Supabase Management API | Mutating tool; conflicts with the repository's current Supabase read-only law |
| `scripts/xopure/setup-custom-objects/index.mjs` | Provisions the manual Phase 1 mirror model | Targets `product`, `period`, `ambassador`, `customer`, and `xoOrder`, not app objects |
| `scripts/xopure/sync-supabase-to-twenty/index.mjs` | Reads Supabase and writes the manual Twenty mirror | Feeds legacy native dashboards |
| `scripts/xopure/port-dashboards/index.mjs` | Creates or updates Dashboard and PageLayout records from frontend templates | Skips live front-components |
| `scripts/xopure/setup-project-management/index.mjs` | Provisions Project and ProjectTask metadata | Separate XO Pure admin customization |
| `packages/twenty-server/src/database/commands/xopure-sync-standard-application.command.ts` | Backfills standard Twenty metadata such as Dashboards into older workspaces | Does not touch custom XO Pure objects |

## Package Audit

- `packages/twenty-ui` has no XO Pure-specific changes relative to the audited
  upstream base. It supplies generic design-system primitives.
- `packages/twenty-front-component-renderer` has no XO Pure-specific changes
  relative to the audited upstream base. It supplies the generic front-component
  runtime.
- `packages/twenty-front` contains the legacy dashboard template/gallery work,
  gauge support changes, root landing customization, and broader XO Pure
  branding changes.
- `packages/twenty-apps/internal/xopure-crm` is the app-owned domain model and is
  now the owner of the primary Mission Control page.

## Branch Divergence

The current branch and `origin/dev` diverged after commit `f95fbd2898`.

- The current branch contains the frontend dashboard templates, manual setup and
  sync scripts, and the three live app front-components.
- `origin/dev` contains a substantially richer app-owned sync implementation,
  more objects, views, roles, and tests.
- `origin/dev` deletes the current frontend dashboard templates, manual scripts,
  and live front-components.
- Neither branch previously contained an app page layout.

This is not a simple "dev has everything" situation. Reconciliation should keep
the app-owned Mission Control and live cards while deliberately migrating useful
app sync work from `origin/dev`.

## Recommended Source Of Truth

Use the `xopure-crm` app as the long-term owner of XO Pure objects, views,
navigation, Mission Control, and live cards. Treat the manual mirror scripts and
legacy frontend template gallery as a transitional fallback until app-owned sync
is reconciled and verified. Do not run the Supabase SQL apply script under the
current read-only operating law.
