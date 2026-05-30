# XO Pure — Admin Mission Control & External Portal Dashboards

> Flagship dashboard designs for three audiences — **admins**, **ambassadors**, and
> **customers** — plus the plan to surface the self-scoped portals to logged-in users handed
> off from `xopure.com`. Translates the card catalog into concrete, buildable template specs.

- **Status:** Design / approved-for-build pending review
- **Owner:** Brian
- **Last updated:** 2026-05-30
- **Companion docs:** [`xopure-dashboard-widget-ideas.md`](./xopure-dashboard-widget-ideas.md) (the card catalog),
  [`xopure-dashboards-and-branding-plan.md`](./xopure-dashboards-and-branding-plan.md) (the build plan),
  [`xopure-ambassador-comp-plan-rules.md`](./xopure-ambassador-comp-plan-rules.md) (comp authority)

---

## 0. The three audiences and their data-scoping model

This is the single most important design decision. Admin dashboards are **global**; the
portal dashboards must be **row-scoped to the logged-in person** — an ambassador sees only
their own book and downline, a customer sees only their own account.

| Audience | Surface | Sees | Scope mechanism | Primary plane |
|---|---|---|---|---|
| **Admin / Ops** | Twenty CRM (internal) | Everything, workspace-wide | No row filter | CRM-native (`GRAPH`/`RECORD_TABLE`) + live |
| **Ambassador** | Portal (from xopure.com) | Only self + downline + own customers/orders/commission | Filtered by authenticated `ambassadorId` | `FRONT_COMPONENT` over Supabase **RLS** |
| **Customer** | Portal (from xopure.com) | Only own orders / subscription / loyalty | Filtered by authenticated `customerId` | `FRONT_COMPONENT` over Supabase **RLS** |

> **Why front-components for portals:** Twenty dashboards are workspace-global by default. Per-user
> self-scoping is cleanest when the widget itself reads the authenticated identity and queries
> Supabase under **RLS scoped to that identity** (read-only anon key — the standing law). The same
> three live widgets already in `twenty-apps/internal/xopure-crm` are the seed of this layer.

Grid convention (from the template engine): **12 columns**. KPI cards = `columnSpan 3` (four across),
charts = `columnSpan 6` (half), tables / hero cards = `columnSpan 12` (full). Rows step by 6.

---

## 1. ADMIN — "Mission Control" (two pages)

Split into two pages so each stays a focused, glanceable command center rather than a wall of charts.

### 1A. Mission Control I — Growth & Revenue

The morning screen: money in, momentum, who's winning, what's live.

```
┌──────────────┬──────────────┬──────────────┬──────────────┐  ← KPI row (columnSpan 3 each)
│ Revenue      │ Total CV     │ Active       │ Active        │
│ (period) ✅  │ (period) ✅  │ Ambassadors✅│ Customers ✅  │
├──────────────┴──────────────┼──────────────┴──────────────┤
│ Revenue over time (line) ✅ │ Orders over time (bar) ✅    │  ← trends (span 6)
├──────────────┬──────────────┼──────────────┬──────────────┤
│ Orders by    │ Revenue by   │ Acquisition  │ Avg Order     │
│ status (pie)✅│ category 🟡 │ source(pie)✅│ Value ✅      │  ← breakdowns
├──────────────┴──────────────┴──────────────┴──────────────┤
│ Top Ambassadors by Group CV — leaderboard/table ✅/🟣      │  ← full-width
├────────────────────────────────────────────────────────────┤
│ Recent Orders (record table) ✅                            │
├──────────────────────────────┬─────────────────────────────┤
│ Live revenue counter 🔵      │ Live order ticker 🔵        │  ← live strip (exists)
└──────────────────────────────┴─────────────────────────────┘
```

| # | Card | Widget | Data | Build |
|---|---|---|---|---|
| 1 | Revenue (period) | aggregate | `xoOrder·totalRetail·SUM` (current period, excl. refunds) | ✅ |
| 2 | Total CV | aggregate | `xoOrder·totalCV·SUM` | ✅ |
| 3 | Active Ambassadors | aggregate | `ambassador·id·COUNT` filter `status=ACTIVE` | ✅ |
| 4 | Active Customers | aggregate | `customer·id·COUNT` filter `isActive=true` | ✅ |
| 5 | Revenue over time | line | `xoOrder·totalRetail·SUM` groupBy `orderedAt` | ✅ |
| 6 | Orders over time | bar | `xoOrder·id·COUNT` groupBy `orderedAt` | ✅ |
| 7 | Orders by status | pie | `xoOrder·id·COUNT` groupBy `status` | ✅ |
| 8 | Revenue by category | bar | `xoOrder·totalRetail·SUM` groupBy `product.category` | 🟡 relation groupBy |
| 9 | Acquisition source | pie | `customer·id·COUNT` groupBy `acquisitionSource` | ✅ |
| 10 | Avg Order Value | aggregate | `xoOrder·totalRetail·AVG` | ✅ |
| 11 | Top Ambassadors by Group CV | leaderboard/table | `ambassador` sort `groupCV DESC` | ✅ table / 🟣 leaderboard |
| 12 | Recent Orders | record table | `xoOrder` newest | ✅ |
| 13 | Live revenue counter | front-component | `LiveMetricCounter` | 🔵 exists |
| 14 | Live order ticker | front-component | `LiveActivityFeed` | 🔵 exists |

### 1B. Mission Control II — Compensation, Risk & Network

The control room: what we owe, what's risky, how the network is shaped.

```
┌──────────────┬──────────────┬──────────────┬──────────────┐  ← KPI row
│ Payouts      │ Payout % of  │ Eligible for │ Chargeback    │
│ (period) ✅  │ retail 🟡 ⌚ │ sweep >$10 🟠│ rate ✅       │
├──────────────┴──────────────┼──────────────┴──────────────┤
│ Held vs Payable (stacked) 🟠│ Payout % trend (line) ✅     │  ← comp
├──────────────┬──────────────┼──────────────┬──────────────┤
│ Rank distrib.│ Fraud score  │ Self-referral│ Elite lapsed  │
│ (bar) ✅     │ histogram 🟡 │ share(pie) ✅│ this period ✅│  ← risk + rank
├──────────────┴──────────────┴──────────────┴──────────────┤
│ Downline / sponsor network (tree) 🟣                       │  ← network hero
├──────────────────────────────┬─────────────────────────────┤
│ Compliance holds (table) ✅  │ Period close workflow ✅    │
└──────────────────────────────┴─────────────────────────────┘
```

| # | Card | Widget | Data | Build |
|---|---|---|---|---|
| 1 | Total payouts (period) | aggregate | `period·totalPayouts·SUM` | ✅ |
| 2 | Payout % of retail | gauge | `period·payoutPercentOfRetail` vs target band | 🟡 gauge range |
| 3 | Eligible for Friday sweep | aggregate+table | ambassadors with `payable > $10` | 🟠 derived balance |
| 4 | Chargeback rate | aggregate·ratio | `status=CHARGEBACK` ÷ all orders | ✅ |
| 5 | Held vs Payable | stacked bar | accrued `held` vs released `payable` | 🟠 derived |
| 6 | Payout % trend | line | `period·payoutPercentOfRetail` groupBy `periodCode` | ✅ |
| 7 | Rank distribution | bar | `ambassador·id·COUNT` groupBy `paidAsRank` | ✅ |
| 8 | Fraud score histogram | bar | `xoOrder·id·COUNT` bucket `fraudScore` | 🟡 bucketing |
| 9 | Self-referral share | pie | `xoOrder·id·COUNT` groupBy `isPersonalOrder` | ✅ |
| 10 | Elite lapsed this period | record table | `ambassador` filter `eliteLapsedThisPeriod=true` | ✅ |
| 11 | Downline network | tree | `ambassador.sponsor/mentees` recursion | 🟣 |
| 12 | Compliance holds | record table | `ambassador` filter `complianceHoldReason` set | ✅ |
| 13 | Period close workflow | workflow | finalize/sweep run status | ✅ |

**Admin verdict:** Page I ships almost entirely on the native engine **today**. Page II is ~60%
native today; the rest unlocks with the gauge range model, bucketing, derived balances, and the
tree primitive — all already on the roadmap.

---

## 2. AMBASSADOR — "My Business" (self-scoped portal)

Everything an ambassador needs to grow and get paid — scoped to **their** `ambassadorId`. This
is the page that makes ambassadors log in daily.

```
┌────────────┬────────────┬────────────┬────────────┐  ← my KPIs
│ My CV this │ My payable │ My rank +  │ Next payout │
│ period 🔵  │ balance 🔵 │ progress🔵🟡│ ⌚ Fri 🔵   │
├────────────┴────────────┼────────────┴────────────┤
│ Rank progress to next   │ Earnings over time      │  ← progress + earnings
│ (gauge: GV/customers)🟡 │ (line) 🔵               │
├────────────┬────────────┼────────────┬────────────┤
│ Earnings by│ Milestone  │ Elite      │ Active      │
│ type(pie)🔵│ progress🟣 │ status 🔵  │ customers🔵 │
├────────────┴────────────┴────────────┴────────────┤
│ My downline (tree, GV per leg) 🟣                  │  ← team hero
├──────────────────────────┬─────────────────────────┤
│ Mentees needing coaching │ My customers (table) 🔵 │
│ (table) 🔵               │                         │
├──────────────────────────┴─────────────────────────┤
│ At-risk customers — win-back action 🔵 + workflow  │
├──────────────────────────┬─────────────────────────┤
│ "You just earned" live   │ Share my referral link  │  ← live + action
│ feed 🔵                  │ + invite (action) 🔵    │
└──────────────────────────┴─────────────────────────┘
```

| Group | Card | Source (scoped to `ambassadorId`) | Maps to comp rule |
|---|---|---|---|
| **KPIs** | My CV this period | `ambassador.personalOrderCV` / period CV | PV / CV |
| | My payable balance | derived `payable` | weekly payout > $10 |
| | My rank + progress | `paidAsRank` + next-rank requirements | R0–R6 ladder |
| | Next payout (amount + Friday ⌚) | payable + sweep clock | Friday ET sweep |
| **Progress** | Rank progress gauge | GV / active customers / PV vs next-rank thresholds | rank reqs |
| | Earnings over time | weekly commission history | customer/team/gen pay |
| | Earnings by type | customer vs team (L1–L4) vs generation (Gen1–4) | earnings breakdown |
| | Milestone progress | monthly GV vs Bronze/Silver/Gold | milestone bonuses |
| | Elite status | `eliteMaintained` + maintenance reqs | elite rules |
| **Team** | My downline tree | `mentees` recursion, GV per leg | GV / generation depth |
| | New enrollments | `personalEnrollments` over time | unlocks L2–L4 |
| | Mentees needing coaching | downline filter dormant/coach-needed | retention |
| **Customers** | My customers | `referredCustomers` table | book of business |
| | At-risk customers | mine, `isActive=false` → win-back workflow | retention |
| **Live/Action** | "You just earned" feed | Supabase realtime commission events | dopamine / engagement |
| | Share referral link / invite | host-API action card | recruiting |

All cards read **Supabase under RLS keyed to the authenticated ambassador** — no cross-ambassador
data leaves the row scope; read-only anon key only.

---

## 3. CUSTOMER — "My XO Pure" (self-scoped portal)

A clean, friendly account home — scoped to **their** `customerId`. Light, not analytics-heavy.

```
┌────────────┬────────────┬────────────┬────────────┐  ← my account
│ Orders     │ Lifetime   │ Subscription│ Next        │
│ count 🔵   │ spend 🔵   │ status 🔵  │ delivery⌚🔵 │
├────────────┴────────────┼────────────┴────────────┤
│ Order history (timeline)│ Spend over time (line) 🔵│
│ 🔵                      │                         │
├──────────────────────────┴─────────────────────────┤
│ Reorder your favorites (product cards + action) 🔵 │
├──────────────────────────┬─────────────────────────┤
│ Manage subscription      │ Refer a friend —         │
│ (status + workflow) 🔵   │ progress + link 🔵      │
├──────────────────────────┴─────────────────────────┤
│ Your ambassador / support — contact (action) 🔵    │
└──────────────────────────┴─────────────────────────┘
```

| Group | Card | Source (scoped to `customerId`) |
|---|---|---|
| **Account** | Orders count | `customer.orderCount` |
| | Lifetime spend | `customer.lifetimeSpend` |
| | Subscription status | `customer.subscriptionStatus` + manage action |
| | Next delivery / renewal ⌚ | subscription next-renewal |
| **Orders** | Order history | `orders` (mine) as timeline/table |
| | Spend over time | `orders·totalRetail·SUM` over time |
| | Reorder favorites | most-ordered products → checkout link |
| **Engagement** | Manage subscription | pause/resume/cancel via workflow/link |
| | Refer a friend | referral progress + share link |
| | Contact ambassador / support | `referrer` / support action |

---

## 4. xopure.com → XO Pure portal handoff (roadmap)

> Intent (technicalities handled later, documented now): a logged-in user on **xopure.com**
> is passed into their XO Pure portal dashboard without a second login.

### 4.1 Identity bridge
- xopure.com authenticates the user (assume **Supabase Auth**). On hand-off, pass the authenticated
  **Supabase session/JWT** (or exchange it for a short-lived, audience-scoped token) to the portal.
- The portal's front-component widgets use that identity to open **RLS-scoped, read-only** Supabase
  reads. The JWT carries the `ambassadorId` / `customerId` claim that RLS policies filter on.
- **Never** a service-role key in the browser; **never** a write path (standing Supabase read-only law).

### 4.2 Surface options (decide later)
1. **Standalone portal app** (recommended) — a thin Next.js/portal surface that renders the same
   self-scoped `FRONT_COMPONENT` widgets, embeddable at `app.xopure.com` or `xopure.com/dashboard`.
   Keeps the Twenty admin UI entirely separate from end users.
2. **Embedded Twenty dashboard** via signed URL + a restricted portal **role** that exposes only the
   self-scoped dashboard (no CRM nav, no records). Heavier; reuses Twenty rendering.
3. **Iframe embed** of option 1 inside xopure.com.

### 4.3 Security & isolation
- RLS policies scope **every** row to the authed identity (`ambassador_id` / `customer_id`).
- Portal users get a **separate role/surface** — no access to admin objects, other people's rows,
  or any mutation. Read-only end to end.
- Audit: log portal token issuance; short token TTL; rotate.

### 4.4 Portal phases
| Phase | Deliverable |
|---|---|
| **D1 — Identity bridge** | xopure.com → portal token hand-off + RLS claim mapping |
| **D2 — Self-scoped data layer** | `useAuthenticatedSupabaseClient` (RLS) + scoped widget data hooks |
| **D3 — Ambassador portal** | "My Business" dashboard, gated to `ambassadorId` |
| **D4 — Customer portal** | "My XO Pure" dashboard, gated to `customerId` |
| **D5 — Polish & embed** | Branding, surface choice (standalone vs embed), responsive, animations |

---

## 5. New templates in the engine

All five admin templates below are now **scaffolded in code** (2026-05-30) in
`packages/twenty-front/src/modules/dashboards/templates/constants/DashboardTemplates.ts`,
joining the original four (`Ambassador Growth`, `Customer 360`, `Revenue & Orders`,
`Live Operations`) — **nine templates total**, all surfaced automatically in the gallery.

| Template | Audience | Tabs | In code? | Build |
|---|---|---|---|---|
| **Admin · Mission Control I — Growth & Revenue** | Admin | Growth & Revenue (12 cards) | ✅ shipped | 100% native |
| **Admin · Mission Control II — Compensation & Network** | Admin | Compensation (11) · Network (9) | ✅ shipped | 100% native |
| **Compliance & Risk Command** | Admin/Ops | Risk (11, incl. fraud-score gauge) | ✅ shipped | 100% native |
| **Recruiting & Onboarding** | Admin | Recruiting & Onboarding (10) | ✅ shipped | 100% native |
| **Product Performance** | Admin | Catalog & Sales (11) | ✅ shipped | 100% native |
| **Ambassador · My Business** | Ambassador (portal) | Earnings · Team · Customers | ⏳ pending D2 | self-scoped 🔵 |
| **Customer · My XO Pure** | Customer (portal) | Account · Orders · Engagement | ⏳ pending D2 | self-scoped 🔵 |

**Scope of the shipped admin templates:** every card resolves on the native engine over
already-synced Phase-1 fields — aggregates, `SELECT`/`DATE`/`BOOLEAN` group-bys, the now-rendering
gauge, and record tables. Deliberately **excluded** (pending engine/data work, tracked in
[the card catalog](./xopure-dashboard-widget-ideas.md)): relation group-bys (revenue-by-product),
filtered cards (held/payable, sweep-eligibility `> $10`, fraud-flagged-only tables), and the
leaderboard / funnel / downline-tree primitives. The onboarding "funnel" ships as a grouped bar
until a funnel primitive exists. A builder unit test asserts **all nine templates resolve every
card** against the deployed object model, guarding against field-name drift.

**Next for templates:**
1. ✅ Done — five admin templates scaffolded and gallery-discoverable.
2. Gauge goal/range, bucketing, and relation group-by upgrades → backfill 🟡 cards (revenue-by-
   product, held vs payable, fraud histogram) into Mission Control II and Compliance & Risk.
3. Comp-engine derived data (🟠) → held/payable and sweep-eligibility cards become real.
4. Portal data layer (D2) → **Ambassador · My Business**, then **Customer · My XO Pure**.

> Templates remain **non-destructive**: the builder skips any widget whose object/field can't
> resolve, so a template degrades gracefully on a workspace that hasn't synced a given object.

---

## 6. How this pushes the main plan further

To fold into [`xopure-dashboards-and-branding-plan.md`](./xopure-dashboards-and-branding-plan.md):

- **New Workstream D — External portals (ambassador & customer facing).** The xopure.com hand-off,
  RLS-scoped self-service dashboards, and the standalone portal surface. Phases D1–D5 above.
- **Expanded A1 template roster** — the eight templates in §5, sequenced by build readiness.
- **Engine upgrades promoted to first-class A-phase items** (each unlocks many admin cards):
  gauge goal/range model, relation group-by, bucketed histogram, leaderboard/funnel/tree primitives.
- **Comp-engine data dependency (🟠)** — held/payable balances, sweep eligibility, milestone tracking
  must be derived (read-only from Supabase / computed in the mirror) before the Compensation templates
  and the ambassador earnings cards are real.
