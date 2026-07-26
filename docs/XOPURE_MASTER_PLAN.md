# XO Pure CRM — Master Execution Plan

**Created:** 2026-07-25
**Owner:** Brian
**Scope:** Upstream Twenty sync → data correctness → ambassador tree visualizations

Check items off as they complete. Each gate is blocking for the next.

---

## 🔒 SUPABASE SAFETY CONTRACT (read before every session)

**Supabase is an absolute read-only source. Nothing in this plan writes to it.**

Verified read-only paths:
- `scripts/xopure/sync-supabase-to-twenty/index.mjs` — `supabaseRest()` throws on any non-GET method (fail-closed). `upsertSyncMap()` is a logging no-op. All `supabasePg` queries are `select`.

### ⛔ QUARANTINED — never execute without explicit human sign-off

| Asset | Why it is dangerous |
|---|---|
| `scripts/xopure/apply-supabase-sql.sh` | POSTs to Supabase Management API with `read_only: false`. This is the only write vector in the repo. |
| `supabase/migrations/202605070001_create_crm_sync_map.sql` | DDL against Supabase |
| `supabase/migrations/202605080001_xopure_affiliate_platform_core.sql` | DDL against Supabase |
| `supabase/migrations/202605080002_create_crm_prospecting_tables.sql` | DDL against Supabase |
| `supabase/migrations/202605220001_allow_multi_object_crm_sync_map.sql` | DDL against Supabase |

Rules:
- [ ] No agent/automation ever invokes `apply-supabase-sql.sh`
- [ ] Supabase MCP server is configured with `read_only=true` only
- [ ] `crm_readonly` role SQL is **authored for human review**, never auto-applied
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never ships in a deployed artifact
- [ ] All destructive-looking commands surfaced for approval, never auto-run

---

## Gate 0 — Safety net

No Supabase contact. Pure git + backup.

- [x] Secret scan of all staged content — clean (no `sb_publishable_`, `sb_secret_`, `service_role`, or JWT literals)
- [x] Commit the dirty working tree → `30e23a7e31` (20 files, +1473/-93)
- [x] Tag rollback point `pre-upstream-merge-2026-07-25`
- [x] Add real upstream remote `twentyhq/twenty`
- [x] Fetch upstream — done. **Twenty is now at `v2.9.0`** (you are on a 2.8-era base).
- [ ] ⚠️ **BLOCKED — human required:** Capture Railway Postgres backup (Twenty DB — *not* Supabase).
      `railway`, `pg_dump`, and `supabase` CLIs are not on the agent's PATH, and this needs production credentials.
- [x] Confirm `.env` still gitignored and untracked

**Exit criteria:** working tree clean, rollback tag exists, upstream fetched, **backup captured**.

> **Note:** the upstream fetch is a convenience for tracking real Twenty release tags.
> The merge itself can proceed from `origin/main`, which already carries upstream code
> (head `763d31a859` is an upstream commit).

---

## Gate 1 — Upstream Twenty sync (1,947 commits)

Merge base `83c40bb8cc` (2026-05-06) → `origin/main` `763d31a859` (2026-07-25).

Customization is 166 new files / 40 modified / only 73 deletions — mostly additive.

- [ ] Create branch `chore/upstream-sync-2026-07`
- [ ] **Retire branding diffs into Docker build overlay** (kills ~60% of conflict surface permanently)
  - [ ] `packages/twenty-emails/*` (9 files)
  - [ ] favicons / `manifest.json` / `index.html` (6 files)
  - [ ] `title-utils.ts`, `FooterNote.tsx`, `NotFound.tsx`, `DefaultWorkspaceName.ts`, `SignInUp.tsx`, `Authorize.tsx`, `SyncEmails.tsx`
- [ ] Merge upstream
- [ ] Resolve infra conflicts: `Dockerfile`, `entrypoint.sh`, `nest-cli.json`, `database-command.module.ts`
- [ ] **Re-derive (do NOT text-merge) the dashboard layer** — upstream restructured this heavily:
  - [ ] `page-layout/widgets/graph/components/GraphWidget.tsx`
  - [ ] `page-layout/widgets/graph/hooks/useGraphWidgetQueryCommon.ts`
  - [ ] `dashboards/templates/*` (5 files)
  - [ ] `app/hooks/useCreateAppRouter.tsx`
  - [ ] `pages/main-dashboard/*`
- [ ] Verify `twenty-sdk` API compat (`defineObject` / `defineFrontComponent` / `definePageLayoutTab` moved between 2.5→2.8+)
- [ ] Typecheck + build clean
- [ ] Run migrations against a **clone** of the Twenty DB first
- [ ] Deploy to Railway, smoke test

**Exit criteria:** app builds and boots on current upstream, dashboards render.

---

## Gate 2 — Schema reconciliation ⚠️ DECISION REQUIRED

> **Sequencing finding:** Gate 2 is **merge-independent**. Every file it touches
> (`spec.mjs`, `sync-supabase-to-twenty/index.mjs`, `packages/twenty-apps/internal/xopure-crm/**`)
> is XO Pure-owned and does not exist upstream, so it cannot conflict with the Gate 1 merge.
> It can safely run **before** Gate 1 — and arguably should, since it fixes a live data bug.

### 🚨 ROOT CAUSE OF "DATA NOT WORKING" (confirmed 2026-07-25)

**The UI and the data are pointed at two different object sets.**

- Every nav item and every Mission Control widget targets `XOPURE_AMBASSADOR_OBJECT_ID`
  (`edcc4b8c-e7eb-4d71-9c09-c2a46bb7b334`) — the **Apps SDK object, which receives zero synced data.**
- The sync script populates `_ambassador` — the **`spec.mjs` object, which holds all the data
  and the populated sponsor tree.**

Affected widgets, all currently rendering empty/zero:
`Total Ambassadors` · `Ambassador Level Mix` · `Commission Earned` · `Attributed Revenue` · `Recent Ambassadors`

Two further problems even if data did flow:
- `Ambassador Level Mix` groups by the `SEED…ELITE` enum, which maps to **no real comp-plan rank**.
- `Commission Earned` sums `totalCommissionEarned`, a scalar field **nothing populates**
  (there is no `commission_ledger` sync).

**Problem:** two competing schemas both define ambassadors, and they disagree.

| | `scripts/.../setup-custom-objects/spec.mjs` | `packages/twenty-apps/internal/xopure-crm/` |
|---|---|---|
| Object | `ambassador` / `customer` / `xoOrder` | `xopureAmbassador` / `xopureCustomer` / `xopureOrder` |
| Ranks | `L0_CUSTOMER`…`L6_ICON` (7) | `SEED`…`ELITE` (6) |
| Sponsor self-relation | ✅ `mentees` ⇄ `sponsor` | ❌ none |
| Has synced data | ✅ yes | ❌ empty |

**Recommendation:** converge on the Apps SDK objects (nav items, Mission Control layout, and front-components already target them).

- [x] **DECIDED: Apps SDK is the single source of truth** (2026-07-25)
- [x] Port `sponsor`/`mentees` self-relation into the App
      (`MANY_TO_ONE`, `joinColumnName: 'sponsorId'`, `onDelete: SET_NULL`)
      → `fields/ambassador-mentees-on-ambassador.field.ts`, `fields/ambassador-sponsor-on-ambassador.field.ts`
- [x] **Fix the rank enum to the 8 real comp-plan ranks**, keyed on internal Supabase key, labelled with guide display name:

  | Supabase key | Display label |
  |---|---|
  | `customer` | Customer |
  | `starter` | Ambassador |
  | `builder` | Partner |
  | `influencer` | Influencer |
  | `promoter` | **Leader** |
  | `leader` | **Executive** |
  | `director` | Director |
  | `icon` | Visionary |

- [x] Make `mapAffiliateRank` **throw on unknown rank** (guide §2.6: never silently drop)
- [x] Rename `level` → `paidAsRank` (stable field UUID + deprecated alias export)
- [x] Repoint `Ambassador Rank Mix` pie chart at `paidAsRank`
- [x] **Enrich `xopureAmbassador`** — careerRank, accountType, trackingCode, customSlug,
      activeCustomerCount, enrollmentCount, personalVolume, teamVolume, monthlyPvCv,
      monthlyGvCv, needsSponsorReview, reparentLocked, directReferralCount, downlineSize,
      treeDepth, joinedAt, convertedToAmbassadorAt
- [x] Add Person ⇄ xopureAmbassador relation (contact identity ↔ business profile)
- [x] Fix the same fictional tier enum on `Person.xopureAmbassadorLevel`
- [x] **Extract comp-plan logic into a pure, unit-tested module** (`lib/comp-plan.mjs`, 28 tests green)
      — rank ladder, status, money, `computeTreeRollups`, `detectCycles`, `findAttentionNeeded`
- [x] Rewrite sync payload builders + repoint target tables → `_xopureAmbassador` etc. (env-overridable)
- [x] Wire `computeTreeRollups` + `findAttentionNeeded` into the ambassador sync pass
- [x] Skip the Period pass (no Apps SDK equivalent) unless `TWENTY_PERIOD_TABLE` is set
- [ ] ⚠️ **HUMAN REQUIRED:** run `DRY_RUN=1` against staging and diff the output
- [ ] Delete the duplicate object set from the workspace (after DRY_RUN looks right)
- [ ] Run the sync live

> ⚠️ **Verification constraint:** the sync script cannot be executed here — it needs live
> Railway + Supabase credentials, and even `DRY_RUN=1` opens a Twenty Postgres connection
> to read table columns. All comp-plan logic has therefore been moved into a pure module
> that *is* testable (`npm test` in `scripts/xopure/sync-supabase-to-twenty`).
> The remaining DB-touching code needs a human to run `DRY_RUN=1` against staging.

### Bugs this closes
- [x] **Every `influencer`-rank ambassador displayed as Starter** — was missing from `rankMap`, fell through to `?? 'L1_STARTER'`
- [x] `promoter` mislabelled "Promoter" — now reads **Leader**
- [x] `leader` mislabelled "Leader" — now reads **Executive**
- [x] Raw internal rank keys leaking into UI — keys are now `value`, display names are `label`
- [x] `Ambassador Level Mix` charting a fictional tier enum

**Exit criteria:** one object set, 8 correct ranks, sponsor tree populated, zero raw keys in UI.

---

## Gate 3 — Close the data gaps

`commission_ledger` — the table the entire Developer Guide is about — **has no object and no sync.** `spec.mjs` line 435: `// Phase 2-5 to follow`.

In dependency order:

- [ ] `commission_ledger` object + sync (highest value)
      incl. `pay_area`, `status`, `pay_cycle`, `cap_adjustment_cents`, `calculation_trace_json`
- [ ] `rank_definitions` object + sync → becomes the display-name lookup, removes hardcoded map
- [ ] Fulfillment fields on `orders` (ShipHero: `shipped_at`, `tracking_*`, `fulfillment_status/error`, `shiphero_synced_at`)
- [ ] `support_tickets` object + sync
- [ ] `affiliate_attributions`
- [ ] `payout_batches` / `payout_batch_items` (masked — **never** raw account numbers)
- [ ] `shipping_sync_queue`

### Display-rule module (guide §2 = LAW)
- [ ] Shared formatter: every rate string carries its basis
      (`"25% of retail"`, `"30% of CV"`, `"4% of CV · generation 2"`, `"5% Team Pool · seat 2 of 4"`)
- [ ] Never render a bare `1.25%`
- [ ] Status labels: `held`→"Clearing (7-day hold)", `payable`→"Payable — next Friday", `accrued`→"Generation — pays on the 5th"
- [ ] **Accrued/monthly generation never sums into a weekly payable total**
- [ ] Pre-2026-07-25 gen rows tagged "legacy Gen Pool"
- [ ] Money is integer cents → divide by 100 at render only
- [ ] Comp week = Fri 00:00 → Thu 23:59 **CST (UTC-6 fixed)**
- [ ] `payout_details` bank fields masked to last4
- [ ] Unmappable pay areas surfaced, never dropped

### Reports (guide §6)
- [ ] Owed today
- [ ] Weekly commission log
- [ ] Per-ambassador statement
- [ ] Compensation audit export
- [ ] COGS / units shipped (filter `fulfillment_status='shipped'`, include `comp`)
- [ ] Stranded shipments alert list (guide §4.2)
- [ ] Orphaned / needs-sponsor-review list (guide §5)

**Exit criteria:** commissions visible and correct, display rules enforced centrally.

---

## Gate 4 — Sync hardening

- [ ] **Author** `crm_readonly` role SQL (`GRANT SELECT` only) — ⛔ human runs it, not the agent
- [ ] Switch sync to `SUPABASE_SYNC_SOURCE=pg` using `crm_readonly`
- [ ] Drop `SUPABASE_SERVICE_ROLE_KEY` dependency entirely
- [ ] Remove hardcoded workspace schema fallback `workspace_5pedu4dl120j0zsebvp6nap5w`
- [ ] Add Supabase MCP server (`read_only=true`) to `.mcp.json`
- [ ] Consider migrating raw-SQL writes → Twenty REST/GraphQL (survives future upgrades)

**Exit criteria:** no service-role key anywhere, no hardcoded schema.

---

## Visualization Sprints

Architecture: **standalone Next.js app embedded as a Twenty dashboard iframe widget.**
Twenty's Remote DOM Web Worker sandbox will fight D3/Three.js — don't build the heavy viz as a front component.

### Two corrections to the original plan
1. **Phase 0 is ~80% already done.** The `sponsor`/`mentees` relation and the `parent_id` walk (`linkAmbassadorSponsors`) already exist. Sprint 1 collapses into Gate 2.
2. **Skip the recursive Logic Function.** Query the Supabase read replica directly via `crm_readonly` with a single **recursive CTE** over `affiliates.parent_id`. One query for the whole tree, versus fighting Twenty's shallow GraphQL depth + 100 req/min cap. Twenty stays the embedding surface and deep-link target; Supabase stays the tree source. Also decouples the viz app from upstream merge churn.

### Prior art to recover before rebuilding
- [ ] Locate `xopure_d3_ambassador_tree.zip` — per `test_for_visuals.md` contains `rateCards.ts`, `types.ts`, `useAmbassadorTree.ts`, `AmbassadorTree.tsx`, `RateCardPanel.tsx`, `AmbassadorTreePage.tsx`. **This is essentially Sprint 3 pre-built.**
- [ ] Locate `xopure_itol_pipeline.zip` (R/iTOL, 903 lines, 8 annotation layers)

### Sprint V1 — Data access ✅ (core complete)
- [x] Recursive CTE returning the full subtree — `apps/ambassador-tree/sql/ambassador-tree.sql`
      (cycle-guarded, depth-bounded, commission buckets separated per LAW §2.5)
- [x] Rank ladder module with display-name mapping — `src/lib/ranks.ts`
- [x] Subtree rollups: downline size, depth, revenue, CV, commissions — `src/lib/tree.ts`
- [x] Lineage / re-root / flatten / top-by-downline-revenue helpers
- [x] **30/30 tests green**, tsc clean
- [ ] Next.js app shell, server-side only credentials
- [ ] `/api/ambassador-tree` route + short-TTL cache

### Sprint V2 — Core node-link tree
- [ ] `d3-hierarchy` for layout math only (no DOM manipulation)
- [ ] SVG React renderer, expand/collapse, collapsed-descendant badges
- [ ] Pan/zoom canvas
- [ ] Path highlighting — one reserved accent colour for the selected lineage
- [ ] Deep link → `https://crm.xopure.com/object/...`
- [ ] Framer Motion 150–250ms eased transitions

### Sprint V3 — Node annotation rings (table2itol-inspired)
- [ ] Tier ring using the **8 correct display ranks** (depends on Gate 2)
- [ ] 6–12 month referral-activity heatmap strip
- [ ] "Active this month" binary dot
- [ ] Revenue-vs-goal gradient bar
- [ ] Rate-card hover card per `paid_as_rank`

### Sprint V4 — Additional layout modes
- [ ] Radial / sunburst
- [ ] Grid / block hierarchy (HeiankyoView-inspired) — for wide networks
- [ ] Parallel-coordinates metrics explorer (Hidden-inspired)

### Sprint V5 — Embed into crm.xopure.com
- [ ] `defineNavigationMenuItem` entry
- [ ] Dashboard iframe widget
- [ ] Optional thin `defineFrontComponent` preview tab on record page
- [ ] `Content-Security-Policy: frame-ancestors https://crm.xopure.com` on the viz app

### Sprint V6 — Performance & polish
- [ ] Lazy-load subtrees (2–3 generations initially)
- [ ] Auto-switch SVG → Canvas/WebGL above ~200 visible nodes
- [ ] Skeleton shimmer loading state
- [ ] Responsive degrade to accordion on narrow viewports
- [ ] Respect host theme tokens (light/dark parity)

### Stretch
- [ ] AI insights panel over the same tree payload (v2 scope)

---

## Progress log

| Date | Gate | Note |
|---|---|---|
| 2026-07-25 | Audit | Full system audit complete. Supabase read-only verified. Plan created. |
| 2026-07-25 | Gate 0 | ✅ Secret scan clean · checkpoint commit `30e23a7e31` · tag `pre-upstream-merge-2026-07-25` · upstream remote added + fetched (Twenty `v2.9.0`). Railway backup still outstanding (human). |
| 2026-07-25 | Gate 2 | ✅ Commit `bd6ff89c8ab` — sponsor/mentees genealogy relation + 8 real comp-plan ranks + fail-loud rank mapping. `node --check` OK, 0 real tsc errors. |
| 2026-07-25 | Gate 2 | ✅ Commit `f60680f4e02` — ambassador schema enriched (17 fields) + Person⇄Ambassador relation + Person tier enum fixed. 0 real tsc errors. |
| 2026-07-25 | Gate 2 | ✅ Commit `fe9b850ddcd` — pure `lib/comp-plan.mjs` with tree rollups, cycle detection, orphan triage. **28/28 tests green.** |
| 2026-07-25 | Gate 2 | ✅ Sync repointed at Apps SDK tables, ambassador payload rewritten, rollups + genealogy health wired in. Awaiting human `DRY_RUN=1`. |
| 2026-07-25 | Sprint V1 | ✅ `apps/ambassador-tree` — recursive CTE + rank ladder + tree assembly. **30/30 tests green**, tsc clean. |
