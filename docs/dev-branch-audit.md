# `dev` Branch Audit

> **Date:** 2026-05-12
> **Repo:** `MyBlockcities/Xopure_crm`
> **Branches surveyed:** `origin/dev` (tip `f95fbd2898`) vs `origin/main` (tip `e69bf7d0f8`)
> **Question:** What's on `dev`? How does it differ from `main`? Is anything unique there? What has actually been built into this fork of Twenty CRM?

---

## TL;DR

1. **`dev` is stale.** Its tip commit (`f95fbd2898 fix railway production deployment`, 2026-05-07) is a strict ancestor of `main`. It has **zero unique commits**. `main` is 4 commits ahead. Nothing has been "built out" on `dev` that isn't also on `main`.
2. **What you're probably remembering** is the XO Pure custom **Twenty Application package** at `packages/twenty-apps/internal/xopure-crm/`. It exists on **both** branches (was added in earlier commits). That's the substantial custom build — about 60 files modelling the XO Pure operating domain as installable schema.
3. **The custom app is high-quality but half-built.** Schema, fields, views, navigation, agents, skills, and roles are defined correctly using the `twenty-sdk@2.2.0` Application API. But the two HTTP routes (`supabase-sync-webhook`, `create-enrichment-task`) are **validation stubs that return without writing anything**. Agents and skills are prompt-only with no LLM wiring.
4. **The bigger blocker:** the production server runs `twentycrm/twenty:v0.32.0`, which predates the Twenty Applications subsystem. So this app **cannot be installed into the live workspace today** without first upgrading the deployed image (or building from this repo's `twenty-server` source at `v0.2.1`).

---

## 1. Branch reality

```
git rev-list --left-right --count origin/main...origin/dev
→ 4   0
  (main-only, dev-only)
```

`dev`'s tip:

```
f95fbd2898  fix railway production deployment       (2026-05-07)
be9c1d3b76  up
a17888765a  updates
83c40bb8cc  fix(server): bypass workspace cache in onboardingStatus resolver (#20322)
b94b198a3b  fix: server.fs.deny bypassed with queries (#20323)
```

`main`-only commits (what `dev` is missing):

```
e69bf7d0f8  fix(docker): use Dockerfile-relative COPY paths for branding overlay
cfceb6ec3b  feat(branding): scaffold project management module + production logo overlay
05392ab8a3  updatess
e0a172b9a2  up
```

```
git merge-base --is-ancestor origin/dev origin/main
→ YES  (dev tip is fully contained in main)
```

So `dev` is **older main**. There is no feature work parked there. The branch is safe to delete, or to fast-forward to `main` if you want a "staging" pointer.

---

## 2. What's actually been built in this repo (both branches)

Three layers, in increasing order of custom-XO-Pure-ness:

### 2.1 Twenty upstream (the base)
Standard Twenty CRM monorepo: `packages/twenty-front`, `packages/twenty-server`, `packages/twenty-shared`, `packages/twenty-ui`, etc. The `packages/twenty-server` `package.json` reports `version: 0.2.1`. This is newer than the `v0.32.0` Docker image that's actually deployed — important.

### 2.2 Railway deploy scaffolding
`services/server/`, `services/worker/`, `services/backup/`, plus root `railway.toml`. All three services use prebuilt `twentycrm/twenty:v0.32.0`. The backup service runs an hourly `pg_dump → gzip → GPG → Cloudflare R2` cron. Documented end-to-end in `docs/xopure-twenty-infra.md`.

### 2.3 The XO Pure Twenty Application — `packages/twenty-apps/internal/xopure-crm/`
This is the meat. Detailed below.

---

## 3. `xopure-crm` Twenty App — Anatomy

Declared in `src/application-config.ts`:

```ts
defineApplication({
  universalIdentifier: 'ce8ec254-f99a-4e12-b23c-8ea97880a30b',
  name: 'xopureCrm',
  label: 'XO Pure CRM',
  variables: [
    { key: 'XOPURE_SYNC_WEBHOOK_SECRET', secret: true },
    { key: 'XOPURE_ENRICHMENT_PROVIDER', default: 'manual' },
  ],
  defaultRoleUniversalIdentifier: '<role uuid>',
})
```

Built on `twenty-sdk@2.2.0` / `twenty-client-sdk@2.2.0` (`package.json`), targets Node 24.5, Yarn 4. Install command (per Twenty App convention): `yarn install && yarn twenty install` against a running Twenty server.

### 3.1 Custom objects (10)

| Object | Purpose | Key fields |
|---|---|---|
| `xopureCustomer` | DTC buyer mirror from Supabase | status (ACTIVE/VIP/AT_RISK/INACTIVE), `coreTags` multi-select (CUSTOMER/AMBASSADOR/WHOLESALE/SUBSCRIPTION/VIP), LTV cents, order count, last order/sync timestamps, `supabaseCustomerId` |
| `xopureAmbassador` | Affiliate/partner mirror | 6-tier level (SEED→ELITE), lifecycle (APPLIED→ACTIVE/PAUSED/REJECTED), referral code, commission rate, attributed revenue, totals, research summary |
| `xopureOrder` | Order header | status, total cents, ambassador code, commissionable boolean |
| `xopureOrderLine` | Per-item order line | quantity, unit/line price cents, CV amount |
| `xopureProduct` | SKU catalog | sku, slug, price cents, currency, category, status (incl. PRE_ORDER), stock, CV amount |
| `xopureCommission` | Commission ledger | amount, rate, status (PENDING/APPROVED/PAID/VOID), `paidAt`, mirror `ambassadorExternalId` / `orderExternalId` |
| `retailProspect` | Stores/wholesalers funnel | stage (NEW→QUALIFIED/DISQUALIFIED), priority score, next follow-up |
| `influencerProspect` | Social-media partner funnel | handle, platform (IG/TT/YT), follower count, engagement rate, same stage funnel |
| `emailSequence` | Sequence definitions | audience type, channel, sequence steps |
| `automationTrigger` | Triggers attached to sequences/agents | RECORD_EVENT / SCHEDULE / WEBHOOK / MANUAL |
| `enrichmentTask` | Research work queue | targetType, targetExternalId, state (QUEUED/RUNNING/DONE/FAILED) |

### 3.2 Standard-object extensions

Four fields are added to Twenty's standard `person` object — clean integration so existing People records double as XO Pure contacts without duplication:

- `xopureCoreTags` — multi-select segmentation
- `xopureSupabasePersonId` — sync key
- `xopureEnrichmentStatus`
- `xopureAmbassadorLevel`

### 3.3 Data model (relations, paired up)

The `src/fields/*-on-*.field.ts` files are relation halves (Twenty requires both sides). Paired:

```
xopureCustomer       1 ──< xopureOrder
xopureOrder          1 ──< xopureOrderLine
xopureProduct        1 ──< xopureOrderLine
xopureOrder          1 ──< xopureCommission
xopureAmbassador     1 ──< xopureCommission
xopureEmailSequence  1 ──< xopureAutomationTrigger
```

All many-to-one halves use `onDelete: SET_NULL`. **Not** related to anything: `retailProspect`, `influencerProspect`, `enrichmentTask`, and standard `person`. The Person ↔ Customer/Ambassador bridge is **implicit** via `xopureSupabasePersonId` + `xopureCoreTags`, not a hard foreign key. There's also no direct `Customer ↔ Ambassador` relation (correct — one Person can be both, modelled via tags).

### 3.4 Views, navigation, role

- **Views** (`src/views/*`): one operating view per object (table layout) — ambassador, commission, customer, influencer-prospecting, order, order-line, product, retail-prospecting.
- **Navigation** (`src/navigation-menu-items/*`): 11 sidebar entries surfacing each custom object plus the standard order/customer concepts.
- **Role** (`src/roles/default-role.ts`): an automation role assignable to **agents and API keys** (not users): read/update/soft-delete on records, no settings/destroy.

### 3.5 AI agents & skills

`src/agents/xopure-research-agent.ts`, `src/agents/xopure-sequence-agent.ts`, plus `src/skills/xopure-contact-enrichment.skill.ts` and `xopure-sequence-strategy.skill.ts`. Each is a `defineAgent` / `defineSkill` call with `name`, `label`, `description`, `icon`, and a free-text `prompt` (agents) or `content` (skills).

**No model selection, no tool list, no input/output schema, no temperature.** The Twenty runtime is expected to bind these to whatever LLM the workspace is configured to use. The research-agent prompt explicitly enforces the separation between prospects and customers/ambassadors. The sequence-agent prompt forbids sending messages without an active automation trigger authorizing it.

### 3.6 Logic functions (HTTP routes)

#### `src/logic-functions/supabase-sync-webhook.ts` (~250 lines)

`POST /xopure/sync/supabase`. Secret-gated by header `x-xopure-sync-secret` ↔ env `XOPURE_SYNC_WEBHOOK_SECRET`. Accepts Supabase Database Webhook payloads (`{type, table, schema, record, old_record}`). Routes the source table through a static map (`affiliates|ambassadors → xopureAmbassador`, `orders → xopureOrder`, etc.) and `normalizeRecordForTwenty` converts cents → dollars, normalizes statuses to uppercase, picks fields per table.

**The endpoint returns the normalized payload + `upsertKey: "{schema}.{table}.{id}"` + a literal `nextStep` string saying:**

> *"Send fieldValues to Twenty Core API upsert and persist the resulting record ID in public.crm_sync_map."*

**It does not actually upsert anything.** The endpoint is a validator + transformer. The expected partner is `supabase/migrations/202605070001_create_crm_sync_map.sql` — that map table only exists on the Supabase side and there is no Twenty-side writer.

Known small bugs / risks: header lookup is case-sensitive on a raw object (could miss `X-Xopure-Sync-Secret`); cents conversion silently drops to 0 when type isn't number; secret comparison is non-constant-time (timing attack trivial, but low risk for an internal webhook).

#### `src/logic-functions/create-enrichment-task.ts` (~65 lines)

`POST /xopure/enrichment/tasks` with `isAuthRequired: true`. Validates `targetType ∈ {CUSTOMER, AMBASSADOR, RETAIL_PROSPECT, INFLUENCER_PROSPECT}` + presence of `targetExternalId`, then returns a normalized payload with `provider: process.env.XOPURE_ENRICHMENT_PROVIDER ?? 'manual'`. Same shape as the sync webhook: a validator stub. `nextStep` literally says:

> *"Wire normalized payload into xopureEnrichmentTask creation after the production API client is configured."*

---

## 4. Install / runtime path

Per `docs/xopure-twenty-infra.md` step 9: *"Deploy/install `packages/twenty-apps/internal/xopure-crm` into the Twenty workspace."* That's the entire spec — no command.

The local `twenty-sdk@2.2.0` ships a `twenty` CLI; the package's `scripts.twenty` wraps it. Standard flow from any app directory: `yarn install && yarn twenty remote add && yarn twenty dev` (or `yarn twenty install` one-shot).

The repo source tree (`packages/twenty-server/src/engine/core-modules/application/`) has full ApplicationInstall / Upgrade modules and a `PreInstalledAppsService`. The repo's `twenty-server` is at `version: 0.2.1` — that supports installable apps.

**But:** `services/server/Dockerfile` and `services/worker/Dockerfile` both pin `FROM twentycrm/twenty:v0.32.0`. That image is from late 2024 and predates the Applications subsystem (added roughly mid-to-late 2025). So while the repo *source* supports apps, the *deployed image* almost certainly does not.

I verified this by querying the live database — only the standard Twenty workspace objects exist (`person`, `company`, `opportunity`, ..., plus my recently-added `project` / `projectTask`). None of `xopureCustomer`, `xopureAmbassador`, etc. are installed. The `metadata.application` table referenced in newer Twenty doesn't even exist on the deployed server.

---

## 5. Gaps and risks

1. **Version mismatch is the headline blocker.** `twenty-sdk@2.2.0`'s install protocol expects server endpoints (GraphQL mutations like `installApplication`) that don't exist in `twentycrm/twenty:v0.32.0`. **Decision point**: either upgrade the deployed image to a build that supports Apps, OR accept this app is design-only documentation until then.
2. **It does not write back to Twenty.** Both logic functions return `nextStep` messages — upserts and creates are unimplemented. There is no Apollo/SDK client setup, no API-key wiring, no `crm_sync_map` writer.
3. **One-way mirror by design — currently zero-way.** Field naming (`supabaseAmbassadorId`, `supabaseCustomerId`, etc.) makes Supabase the source of truth. No write-back to Supabase exists, which is correct, but the *forward* path is also unimplemented.
4. **Many TODO/stub markers.** Both logic functions end with literal `nextStep:` strings; the related `docs/xopure-crm-extension-ideas.md` (only on `main`) lists the missing pieces explicitly.
5. **No tests.** `vitest` is configured but there are zero test files. `normalizeRecordForTwenty` is the obvious unit-test target.
6. **No page layouts or front components.** Schema only; UI customizations (Ambassador dashboard, payout views) are not present.
7. **Required env on the running app:** `XOPURE_SYNC_WEBHOOK_SECRET`, `XOPURE_ENRICHMENT_PROVIDER`. These would be set as Twenty *app* variables once installed (not OS env vars).

---

## 6. Extension-ideas doc (`docs/xopure-crm-extension-ideas.md`)

20KB self-audit (on `main` only) that:

- Explains how Twenty Apps are structured and what each `define*` call does.
- Inventories the current XO Pure app object-by-object.
- Lists important missing pieces: production upsert writer, backfill, referral-attribution ledger, payout-batch object, commission-plan/rule object, page layouts, front components.
- Recommends building an **"Ambassador Revenue Operations"** layer next: `xopureReferralEvent`, `xopurePayoutBatch`, `xopureCommissionPlan`, ambassador dashboard layouts, real Supabase sync writer.
- Explicitly recommends **extending this single app** rather than creating a second one.

---

## 7. Final assessment

**Is this useful?** Yes — as a schema-and-domain-model definition, it is high-quality, idiomatic Twenty App code. Stable universal identifiers, sensible relations, properly separated prospect/customer/ambassador concerns, clean domain segmentation via tags. The Person extensions are particularly clean. It captures the XO Pure operating model precisely.

**Is it ready to use?** No, for two reasons:
1. The deployed Twenty image (`v0.32.0`) predates the installable-app system — this app cannot be installed into the live `crm.xopure.com` workspace today.
2. The HTTP routes are validation stubs; nothing actually writes records into Twenty.

**Recommended next steps, in order:**

1. **Pick a runtime path** — either (a) move the deployed image off `twentycrm/twenty:v0.32.0` (build from this repo's `twenty-server` source at `v0.2.1`), or (b) accept this app is documentation-only until that upgrade happens. Without this, nothing else matters.
2. **Once the runtime supports apps**, run `yarn twenty install` against the workspace and verify objects/fields/views appear. Wire the workspace API key/URL config so logic functions can call Twenty's GraphQL.
3. **Implement the Supabase webhook writer** — replace the `nextStep` stub with real upserts via the Twenty client SDK, using `upsertKey` as the idempotency key, and persist the Twenty record ID into `public.crm_sync_map` on the Supabase side. Add a backfill route that replays a date range.
4. **Wire the enrichment-task creator** to actually `create` an `xopureEnrichmentTask` record, then trigger the research agent.
5. **Follow the extension-ideas roadmap** (`xopureReferralEvent`, `xopurePayoutBatch`, `xopureCommissionPlan`).
6. **Add tests.** Unit-test `normalizeRecordForTwenty` for every source table.

**For a smart-but-non-expert engineer joining this code:** read it as **a strongly-typed schema declaration with two stubbed HTTP routes attached**. The schema is the asset; the runtime behavior is mostly a placeholder waiting for a server that can host it.

---

## 8. Suggested branch hygiene

- `dev` adds no value and is confusing. Either delete it or fast-forward it to `main`.
- Consider creating a `deploy` branch that Railway watches, so you can stage changes on `main` before they roll to production.
