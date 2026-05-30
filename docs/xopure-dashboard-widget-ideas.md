# XO Pure — Dashboard Widget / Card Ideas

> A grounded catalog of dashboard cards to build, derived from the **actual** XO Pure data
> model (`scripts/xopure/setup-custom-objects/spec.mjs`), the locked ambassador compensation
> rules (`docs/xopure-ambassador-comp-plan-rules.md`), the Twenty widget engine, and the live
> Supabase widgets already in `packages/twenty-apps/internal/xopure-crm`.

- **Status:** Idea backlog — analysis, not yet scheduled
- **Owner:** Brian
- **Last updated:** 2026-05-30
- **Companion docs:** [`xopure-admin-and-portal-dashboards.md`](./xopure-admin-and-portal-dashboards.md)
  (these cards organized into flagship admin/ambassador/customer dashboards),
  [`xopure-dashboards-and-branding-plan.md`](./xopure-dashboards-and-branding-plan.md),
  [`xopure-ambassador-comp-plan-rules.md`](./xopure-ambassador-comp-plan-rules.md)

---

## 0. How to read this catalog

Every card below maps to a **real widget primitive** and **real synced fields**. Two data
planes (per the architecture in the main plan):

- **CRM-native widgets** (`GRAPH`, `RECORD_TABLE`) read the **synced XO Pure Postgres mirror**.
- **Live widgets** (`FRONT_COMPONENT`) read **Supabase Realtime directly** with the RLS-scoped
  anon key (read-only law). Three already exist: `LiveMetricCounter`, `LiveActivityFeed`,
  `RealtimeRevenueLineChart`.

### Widget primitives available today

| Primitive | What it does | Notes |
|---|---|---|
| `GRAPH · aggregate` | one big number (count/sum/avg/min/max of a field) | + ratio mode |
| `GRAPH · bar` / `line` | groupBy (select/date) × aggregate | trends, breakdowns |
| `GRAPH · pie` | groupBy × aggregate as share | composition |
| `GRAPH · gauge` | single value vs a max | **router fixed 2026-05-30**; max is *derived* until a persisted goal/range model exists |
| `RECORD_TABLE` | a saved view of records | filters, sorts |
| `FRONT_COMPONENT` | sandboxed React, host theme + Supabase Realtime | live/custom render |
| `IFRAME` | embed external | e.g. Metabase, Stripe |
| `WORKFLOW` / `WORKFLOW_RUN` | trigger + show automation | pairs with cards for action |
| `FIELD(S)` · `NOTES` · `TASKS` · `CALENDAR` · `TIMELINE` | record-scoped widgets | for record-page dashboards |

### Build-status legend

- ✅ **Native now** — buildable with the current engine + already-synced fields.
- 🟡 **Native, small dependency** — needs the gauge goal/range model, or group-by on a relation field.
- 🔵 **Front-component** — custom render and/or Supabase Realtime.
- 🟠 **Needs data** — a derived comp-engine field or an expanded *read-only* sync mapping
  (Supabase stays read-only; we only read more, or compute in the Twenty mirror).
- 🟣 **New widget primitive** — worth adding to the engine (funnel, leaderboard, tree, heatmap, geo).

---

## 1. Executive / Revenue dashboard

The "one screen the owner checks every morning."

| Card | Widget | Data (object · field · op / groupBy) | Why it matters | Build |
|---|---|---|---|---|
| Total Revenue (period) | `aggregate` | `xoOrder · totalRetail · SUM` (filter: current period) | Headline number | ✅ |
| Total CV (period) | `aggregate` | `xoOrder · totalCV · SUM` | Commission base; drives payouts | ✅ |
| Revenue over time | `line` | `xoOrder · totalRetail · SUM` groupBy `orderedAt` | Trend at a glance | ✅ |
| Orders by status | `pie` | `xoOrder · id · COUNT` groupBy `status` | Pending→Delivered health; refund/chargeback share | ✅ |
| Avg order value | `aggregate` | `xoOrder · totalRetail · AVG` | Pricing/upsell signal | ✅ |
| Payout ratio (period) | `gauge` | `period · payoutPercentOfRetail` vs target band | Margin guardrail; comp cost vs retail | 🟡 (gauge range) |
| Revenue by product category | `bar` | `xoOrder · totalRetail · SUM` groupBy `product.category` | Which line (NAD+, MetaLean…) sells | 🟡 (relation groupBy) |
| Net revenue (excl. refunds) | `aggregate · ratio` | `xoOrder · totalRetail · SUM` filtered `status ≠ REFUNDED,CHARGEBACK` | Honest top line | ✅ |
| Live revenue today | `FRONT_COMPONENT` | `RealtimeRevenueLineChart` (Supabase orders) | Push updates, no refresh | 🔵 (exists) |

---

## 2. Ambassador performance & compensation

The richest object (`ambassador` has rank, tier, CV rollups, elite flags). Maps directly to the
comp plan (CV/PV/GV, ranks R0–R6, milestones, team/generation pay).

| Card | Widget | Data | Why it matters | Build |
|---|---|---|---|---|
| Active ambassadors | `aggregate` | `ambassador · id · COUNT` filter `status = ACTIVE` | Field strength | ✅ |
| Ambassadors by paid-as rank | `pie`/`bar` | `ambassador · id · COUNT` groupBy `paidAsRank` | Rank distribution (Starter→Icon) | ✅ |
| Paid-as vs qualified rank gap | `bar` | COUNT groupBy `paidAsRank` vs `qualifiedRank` (two series) | Who is under-earning their rank | 🟡 (two-series) |
| New ambassadors over time | `line` | `ambassador · id · COUNT` groupBy `enrolledAt` | Recruiting momentum | ✅ |
| Group CV leaderboard | `RECORD_TABLE` / 🟣 | `ambassador` sorted `groupCV DESC`, show rank/tier | Top builders; the card everyone wants | ✅ table / 🟣 leaderboard |
| Lifetime earnings (top 10) | `bar` | `ambassador · lifetimeEarnings` top-N | Recognition | 🟣 (top-N bar / leaderboard) |
| Elite maintained vs lapsed | `pie` | `ambassador · id · COUNT` groupBy `eliteMaintained` | Elite-program health | ✅ |
| Elite lapses this period | `RECORD_TABLE` | `ambassador` filter `eliteLapsedThisPeriod = true` | Coaching outreach list | ✅ |
| Onboarding funnel | 🟣 funnel | `ambassador` groupBy `onboardingStage` (Invited→Active, Coach-Needed/Dormant) | Where new ambassadors stall | 🟣 (funnel) / ✅ as pie |
| Avg active customers per ambassador | `aggregate` | `ambassador · activeCustomerCount · AVG` | Depth of each book of business | ✅ |
| Personal enrollments distribution | `bar` | `ambassador · id · COUNT` groupBy `personalEnrollments` | Unlocks team-pay levels (L1–L4) | ✅ |
| Milestone bonuses earned | `aggregate`/`RECORD_TABLE` | Bronze/Silver/Gold from monthly GV | Lifetime one-time bonuses | 🟠 (comp-engine derived) |
| Commission tier mix | `pie` | `ambassador · id · COUNT` groupBy `currentTier` | 30/35/40/45% slice exposure | ✅ |

---

## 3. Compensation engine / payouts / periods

Directly operationalizes the locked rules: **weekly disbursement of payable > $10, 7-day hold,
Friday sweep (America/New_York)**, level caps (50% CV) and generation caps (40% CV).

| Card | Widget | Data | Why it matters | Build |
|---|---|---|---|---|
| Period status | `FIELD`/`aggregate` | `period · status` (Open/Locked/Finalized/Paid) | Where the close cycle is | ✅ |
| Total payouts (period) | `aggregate` | `period · totalPayouts · SUM` | Cash out the door | ✅ |
| Payout % of retail trend | `line` | `period · payoutPercentOfRetail` groupBy `periodCode` | Comp-cost trajectory across periods | ✅ |
| Held vs payable balance | `bar` (stacked) | accrued `held` vs released `payable` | Friday-sweep readiness | 🟠 (needs balance fields) |
| Eligible for Friday sweep (> $10) | `aggregate` + `RECORD_TABLE` | count/sum of ambassadors with `payable > $10` | Exactly the disbursement rule | 🟠 (needs payable field) |
| Next sweep countdown | `FRONT_COMPONENT` | clock to next Friday 00:00 ET | Operational urgency | 🔵 |
| Cap pressure (level ≥ 50% CV) | `RECORD_TABLE` | orders/ambassadors hitting the 50% L1–L4 cap | Where caps prorate | 🟠 (comp-engine) |
| Fast Start pool (2% of period CV) | `aggregate` | `period · totalCV · SUM × 0.02` | First-60-day pool size | 🟠 (derived) |
| Payout method split | `pie` | `xoOrder · id · COUNT` groupBy `paymentMethod` | Stripe vs PayPal reconciliation | ✅ |
| Unpaid finalized periods | `RECORD_TABLE` | `period` filter `status = FINALIZED` | Finance to-do | ✅ |

> All comp math stays **read-only against Supabase** — derived balances are computed in the
> Twenty mirror or read from Supabase-computed columns, never written back.

---

## 4. Customer & retention

| Card | Widget | Data | Why it matters | Build |
|---|---|---|---|---|
| Total / active customers | `aggregate` | `customer · id · COUNT` (filter `isActive`) | Base size & 60-day-active health | ✅ |
| Customers by subscription | `pie` | `customer · id · COUNT` groupBy `subscriptionStatus` | Active/Paused/Cancelled churn signal | ✅ |
| New customers over time | `line` | `customer · id · COUNT` groupBy `enrolledAt` | Acquisition trend | ✅ |
| Acquisition source mix | `pie` | `customer · id · COUNT` groupBy `acquisitionSource` | Direct/Social/Event/Referral ROI | ✅ |
| Lifetime spend distribution | `bar` | `customer · lifetimeSpend` bucketed | Whales vs one-timers | 🟡 (bucketing) |
| Avg lifetime CV | `aggregate` | `customer · lifetimeCV · AVG` | Customer value to comp pool | ✅ |
| At-risk customers (no order > 60d) | `RECORD_TABLE` | `customer` filter `isActive = false`, sort `lastOrderAt` | Win-back list | ✅ |
| Subscription churn over time | `line` | COUNT groupBy `enrolledAt` filter `subscriptionStatus = CANCELLED` | Retention bleed | ✅ |
| Repeat-purchase rate | `aggregate · ratio` | `customer` with `orderCount > 1` ÷ all | Loyalty | ✅ |
| Cohort retention heatmap | 🟣 heatmap | enroll month × active rate | Best retention card there is | 🟣 |

---

## 5. Product & catalog

| Card | Widget | Data | Why it matters | Build |
|---|---|---|---|---|
| Revenue by product | `bar` | `xoOrder · totalRetail · SUM` groupBy `product` | Bestsellers | 🟡 (relation groupBy) |
| Units sold by category | `bar` | `xoOrder · quantity · SUM` groupBy `product.category` | NAD+ vs MetaLean vs Klow demand | 🟡 |
| Active vs inactive SKUs | `pie` | `product · id · COUNT` groupBy `isActive` | Catalog hygiene | ✅ |
| Commission-eligible revenue | `aggregate` | `xoOrder · totalRetail · SUM` filter `product.commissionEligible` | What actually feeds comp | 🟠/🟡 |
| Avg CV ratio by product | `bar` | `product · cvAmount ÷ retailPrice` | Margin per SKU | 🟠 (computed) |
| Discount-code usage | `bar` | `xoOrder · id · COUNT` groupBy `discountCode` | Promo effectiveness | ✅ |

---

## 6. Compliance, risk & fraud

The model is unusually rich here (`fraudScore`, `fraudFlagged`, `complianceHoldReason`,
`restrictedClaims`, chargebacks) — a genuine differentiator.

| Card | Widget | Data | Why it matters | Build |
|---|---|---|---|---|
| Fraud-flagged orders | `aggregate` | `xoOrder · id · COUNT` filter `fraudFlagged = true` | Risk volume | ✅ |
| Fraud score distribution | `bar` | `xoOrder · id · COUNT` bucket `fraudScore` (0–100) | Where the risky tail sits | 🟡 (bucketing) |
| Chargeback rate | `aggregate · ratio` | `status = CHARGEBACK` ÷ all orders | Processor-health KPI | ✅ |
| Refund $ in hold window | `aggregate` | `xoOrder · totalRetail · SUM` filter `status = REFUNDED` & within 7-day hold | Clawback exposure pre-release | 🟠 |
| Ambassadors on compliance hold | `RECORD_TABLE` | `ambassador` filter `complianceHoldReason` set | Payout-hold worklist | ✅ |
| Self-referral / personal-order share | `pie` | `xoOrder · id · COUNT` groupBy `isPersonalOrder` | Self-order vs real retail (PCV integrity) | ✅ |
| Velocity anomalies (live) | `FRONT_COMPONENT` | Supabase Realtime order stream + threshold | Catch fraud as it happens | 🔵 |
| Restricted-claims watch | `RECORD_TABLE` | `product` with `restrictedClaims` set | Marketing/legal guardrail | ✅ |

---

## 7. Network / downline (relationship-graph cards)

The schema has a real MLM graph: `ambassador.sponsor ↔ mentees`, `referredCustomers`,
`referredOrders`. These are the cards a flat CRM can't do.

| Card | Widget | Data | Why it matters | Build |
|---|---|---|---|---|
| Downline tree (depth, GV per leg) | 🟣 tree | `ambassador.sponsor/mentees` recursion | Visualize a leg; spot dead branches | 🟣 |
| Sponsor leaderboard (mentee count) | 🟣 leaderboard | `ambassador` COUNT of `mentees` | Best recruiters | 🟣 / 🟠 (rollup) |
| Orphaned ambassadors (no sponsor) | `RECORD_TABLE` | `ambassador` filter `sponsor` null | Placement cleanup | ✅ |
| Referral attribution flow | 🟣 sankey | ambassador → referredCustomers → referredOrders | Where revenue is actually sourced | 🟣 |
| Generation depth unlocked | `bar` | `ambassador` groupBy unlocked generations (rank R3–R6) | Generation-pay exposure | 🟠 |

---

## 8. Live operations (Supabase Realtime, FRONT_COMPONENT)

Extends the three existing live widgets. All read-only anon-key + RLS.

| Card | Widget | Source | Why it matters | Build |
|---|---|---|---|---|
| Live order ticker | `FRONT_COMPONENT` | `LiveActivityFeed` over `orders` | Pulse of the business | 🔵 (exists) |
| Live revenue counter (today) | `FRONT_COMPONENT` | `LiveMetricCounter` (`XOPURE_LIVE_METRIC_TABLE`) | Animated KPI | 🔵 (exists) |
| Live signups counter | `FRONT_COMPONENT` | `LiveMetricCounter` table = `affiliates`/`customers` | Recruiting/acq pulse | 🔵 (exists, config) |
| Realtime revenue line | `FRONT_COMPONENT` | `RealtimeRevenueLineChart` | Streaming trend | 🔵 (exists) |
| Live geo signup map | 🟣 + 🔵 | Supabase + `customer.shippingAddress` | Where growth is happening | 🟣🔵 |
| "New milestone hit" toast feed | `FRONT_COMPONENT` | Realtime + comp events | Celebrate Bronze/Silver/Gold live | 🔵🟠 |

---

## 9. Agentic & action cards (Workstream A4 foundation)

The `FRONT_COMPONENT` host API already exposes `navigate`, `openCommandConfirmationModal`,
`updateProgress`, `enqueueSnackbar` — and `WORKFLOW` widgets can trigger automations from a card.

| Card | Widget | Idea | Build |
|---|---|---|---|
| "Coach these ambassadors" action list | `FRONT_COMPONENT` + `WORKFLOW` | Dormant/Coach-Needed list with a one-click outreach workflow | 🔵 |
| Period-close runner | `WORKFLOW_RUN` | Show finalize/sweep workflow status inline | ✅ (workflow widget) |
| Win-back campaign trigger | `FRONT_COMPONENT` + `WORKFLOW` | At-risk customers → enqueue email sequence | 🔵 |
| AI "what changed this week" summary | `FRONT_COMPONENT` | LLM digest over the mirror (read-only) | 🔵🟠 |

---

## 10. Net-new widget primitives worth building

These unlock whole categories above and are reusable across dashboards:

1. **Leaderboard / top-N ranked list** 🟣 — ranked rows with avatar, value, delta. (Comp,
   recruiting, product — used a dozen places.)
2. **Funnel** 🟣 — ordered stages with drop-off %. (Onboarding stage, order status pipeline.)
3. **Gauge goal/range model** 🟡 — persist `min/max/goal` on `GaugeChartConfiguration` so gauges
   show *real* targets (payout-ratio band, period progress) instead of a derived max. *(Direct
   follow-up to the 2026-05-30 router fix.)*
4. **Bucketed histogram** 🟡 — numeric range buckets (fraud score, lifetime spend, enrollments).
5. **Relation group-by** 🟡 — let GRAPH group by a related object's field (revenue by product
   category, by ambassador) without a custom component. Highest-leverage engine upgrade.
6. **Cohort retention heatmap** 🟣 — enroll-cohort × period activity grid.
7. **Downline tree / org chart** 🟣 — recursive sponsor→mentee graph with per-leg rollups.
8. **Geo map** 🟣 — choropleth/points from `shippingAddress`.
9. **KPI with sparkline + delta** 🟡 — `aggregate` plus a mini-trend and vs-prior-period %.

---

## 11. Suggested first build set (impact × effort)

| Priority | Cards | Rationale |
|---|---|---|
| **P0 — ship now (✅ native)** | Exec dashboard §1 (revenue, CV, orders-by-status, AOV, payout-method); Ambassador rank mix & active count §2; Customer subscription & acquisition §4 | Zero new infra; immediate executive value; validates the template gallery end-to-end |
| **P1 — small engine upgrades (🟡)** | Gauge goal/range model → payout-ratio & period-progress gauges; relation group-by → revenue-by-product/category; bucketed histograms (fraud score, lifetime spend) | Each unlocks many cards; gauge work already started |
| **P2 — comp-engine data (🟠)** | Held vs payable, Friday-sweep eligibility (> $10), milestone bonuses, Fast Start pool | The operational heart of XO Pure; needs derived balances (read-only from Supabase / computed in mirror) |
| **P3 — new primitives (🟣)** | Leaderboard, onboarding funnel, cohort heatmap, downline tree | Differentiators; reusable; higher build cost |
| **P4 — live & agentic (🔵)** | Geo signup map, milestone toast feed, coaching/win-back action cards | Build on existing realtime widgets + workflow host API |

---

## 12. Cross-cutting constraints (read before building)

- **Supabase is read-only.** Cards needing data not in the mirror require either (a) an
  expanded read-only sync mapping, or (b) a Supabase-side computed column we only *read*, or
  (c) computation in the Twenty mirror. Never a write-back. See `CLAUDE.md`.
- **Comp authority.** Any compensation card must match
  [`xopure-ambassador-comp-plan-rules.md`](./xopure-ambassador-comp-plan-rules.md) — notably the
  **weekly payout of payable > $10**, 7-day hold, Friday ET sweep, 50% level / 40% generation caps.
- **Object model.** Cards target the deployed Phase-1 model (`product`, `period`, `ambassador`,
  `customer`, `xoOrder`) — the sync target. The app-scoped `xopure*` model is not yet the source
  for native cards (see the consolidation follow-up in the main plan).
- **Non-destructive templates.** The template builder skips widgets whose object/field can't
  resolve, so shipping a card that depends on a not-yet-synced field degrades gracefully.
- **Theme tokens only.** All custom widgets consume host theme tokens (light/dark parity) — no
  hardcoded colors.
