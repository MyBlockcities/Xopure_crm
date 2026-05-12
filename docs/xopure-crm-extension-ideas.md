# XO Pure CRM App Extension Ideas

Last updated: 2026-05-12

## Scope

This note reviews how Twenty apps are set up in `packages/twenty-apps`, what already exists in `packages/twenty-apps/internal/xopure-crm`, how the scripts in `packages/twenty-front/scripts` affect development, and what to build next for ambassador, payment, referral, and prospecting operations.

## How Twenty Apps Are Set Up

Twenty apps are standalone packages that export app metadata and installable entities through `twenty-sdk/define`.

The normal app shape is:

```text
packages/twenty-apps/<category>/<app-name>/
  package.json
  tsconfig.json
  src/
    application-config.ts
    objects/
    fields/
    views/
    navigation-menu-items/
    roles/
    logic-functions/
    front-components/
    page-layouts/
    agents/
    skills/
  public/
```

The key rule is that files default-export one of the SDK define calls:

- `defineApplication` in `src/application-config.ts` declares the app identity, display name, description, icon/logo, screenshots, app variables, server variables, and default role.
- `defineObject` creates custom CRM objects and inline fields.
- `defineField` adds standalone fields, including fields on standard objects like `person`, and bidirectional relation fields.
- `defineView` creates saved views for objects.
- `defineNavigationMenuItem` adds sidebar entries for objects, views, pages, or folders.
- `defineRole` grants permissions used by app functions, agents, users, or API keys.
- `defineLogicFunction` creates callable code with HTTP route, cron, database event, or tool triggers.
- `defineFrontComponent` renders React UI inside Twenty.
- `definePageLayout` and `definePageLayoutTab` build dashboard or record-page surfaces.
- `defineAgent` and `defineSkill` add AI agent behavior and reusable context.
- `defineConnectionProvider` supports OAuth-style external app connections.

The SDK build process scans the app source for those default-exported define calls and builds a manifest. A valid app must export one `defineApplication`. Entity identity is controlled by stable `universalIdentifier` values, so field/object IDs should be generated once and preserved.

Common dev/install flow from an app directory:

```bash
yarn install
yarn twenty remote add
yarn twenty dev
```

`yarn twenty dev` builds, installs, watches, syncs manifest changes, and refreshes generated app client/types. `yarn twenty install` is the one-shot install path. Existing examples worth using as references:

- `examples/hello-world`: smallest app structure.
- `examples/postcard`: rich app covering objects, fields, functions, front components, roles, views, navigation, skills, agents, and page layouts.
- `community/github-connector`: mature external connector with variables, sync functions, front components, dashboard widgets, webhooks, and integration tests.
- `internal/twenty-for-twenty`: internal sync-heavy app with external-service variables, schema, front components, manual sync UI, and cursor-based sync logic.

## Current XO Pure App

`packages/twenty-apps/internal/xopure-crm` already exists and should be the starting point. It currently defines the XO Pure operating model as a Twenty app named "XO Pure CRM".

Current app-level variables:

- `XOPURE_SYNC_WEBHOOK_SECRET`
- `XOPURE_ENRICHMENT_PROVIDER`

Current custom objects:

| Object | Purpose |
|---|---|
| `xopureCustomer` | Customer profile mirror with Supabase/commerce IDs, status, tags, LTV, order count, last order, and last sync timestamp. |
| `xopureAmbassador` | Ambassador lifecycle, tier, referral code, commission rate, attributed revenue, commission earned, and research summary. |
| `xopureOrder` | Order summary with Supabase/commerce IDs, status, total, ordered timestamp, customer external ID, ambassador code, and commissionable flag. |
| `xopureOrderLine` | Item-level order details with order/product source IDs, SKU, quantity, price, line total, CV amount, and category. |
| `xopureProduct` | Product catalog mirror with SKU, slug, price, currency, category, status, stock, CV amount, URL, and sync timestamp. |
| `xopureCommission` | Ambassador commission and payout tracking with source IDs, amount, rate, status, and paid timestamp. |
| `retailProspect` | Retail/wholesale prospecting database with contact details, stage, priority, sequence, follow-up, and research summary. |
| `influencerProspect` | Creator prospecting database with handle, platform, email, followers, engagement, stage, priority, sequence, and research summary. |
| `xopureEmailSequence` | Reusable outreach/lifecycle sequence definition by audience, status, trigger, step count, and owner. |
| `xopureAutomationTrigger` | Trigger configuration for record events, schedules, webhooks, or manual actions tied to sequences/agents. |
| `xopureEnrichmentTask` | Research/enrichment queue for customers, ambassadors, retail prospects, and influencer prospects. |

Current standard `person` extensions:

- `xopureCoreTags`
- `xopureSupabasePersonId`
- `xopureEnrichmentStatus`
- `xopureAmbassadorLevel`

Current relations:

- Customer to orders.
- Order to order lines.
- Product to order lines.
- Order to commissions.
- Ambassador to commissions.
- Email sequence to automation triggers.

Current views/navigation:

- Customer Command Center.
- Ambassador Levels.
- Synced Orders.
- Commission Pipeline.
- Product and order line operating views.
- Retail Prospecting.
- Influencer Prospecting.
- Object-level sidebar entries for the above plus enrichment tasks, email sequences, and automation triggers.

Current logic functions:

- `xopure-supabase-sync-webhook`: accepts Supabase-style payloads, validates `x-xopure-sync-secret`, maps source tables to Twenty object names, and normalizes field values. It currently returns the normalized payload and a "next step" message instead of writing records.
- `xopure-create-enrichment-task`: validates an enrichment task request and returns a normalized payload. It does not yet create `xopureEnrichmentTask` records.

Current AI surface:

- XO Pure Research Agent.
- XO Pure Sequence Agent.
- XO Pure Contact Enrichment skill.
- XO Pure Sequence Strategy skill.

## Important Gaps

The current app is a solid schema foundation, but it is still mostly structural.

The most important missing pieces:

- No production upsert writer from Supabase/webhook payloads into Twenty records.
- No backfill route or replay tooling for historical customer/order/commission data.
- No first-class referral event/attribution ledger; referral code exists on ambassador and ambassador code exists on order, but clicks, signups, purchases, refunds, and attribution decisions are not separately auditable.
- No payout batch object for grouping approved commissions into payment runs.
- No commission plan/rule object for tiered rates, product-specific rates, effective dates, clawbacks, or manual adjustments.
- No page layouts or front components for an ambassador dashboard, payout approval console, referral timeline, or customer/referral 360 view.
- Existing views are simple table views and do not yet express queues like pending payouts, failed syncs, at-risk ambassadors, or prospects needing follow-up.
- Prospect-to-ambassador/customer conversion is not formalized.

## Front-End Scripts Analysis

The scripts in `packages/twenty-front/scripts` are primarily for front-end build/runtime configuration and generated test fixtures. They do not install app schema.

### `inject-runtime-env.sh`

Injects `REACT_APP_SERVER_BASE_URL` into `build/index.html` at runtime. This is deployment plumbing for the front-end bundle.

Implication for XO Pure: use this when serving the compiled front end against a different Twenty server URL. It does not affect app manifest installation or XO Pure CRM schema.

### `generate-mock-data.ts`

Orchestrates local mock generation:

1. Authenticates against a local workspace using hardcoded dev credentials and the `apple` workspace subdomain.
2. Fetches full object metadata.
3. Fetches minimal metadata.
4. Fetches sample records.
5. Fetches roles, views, navigation menu items, billing plans, and API keys.
6. Writes generated fixture files under `packages/twenty-front/src/testing/mock-data/generated`.

### `mock-data/utils.ts`

Defines:

- `SERVER_BASE_URL`, defaulting to `http://localhost:3000`.
- `WORKSPACE_ORIGIN`, derived from the `apple` subdomain.
- `graphqlRequest`, used against `/metadata` and `/graphql`.
- `authenticate`, which gets a bearer token via metadata auth mutations.
- `writeGeneratedFile`, which writes generated TypeScript fixture files.

### Metadata generators

These fetch workspace metadata from a running Twenty server:

- `generate-object-metadata.ts`: fetches full object and field metadata, including custom app-defined objects if the app is installed in that workspace.
- `generate-minimal-metadata.ts`: fetches minimal metadata and collection hashes.
- `generate-views.ts`: fetches all views.
- `generate-navigation-menu-items.ts`: fetches sidebar metadata.
- `generate-roles.ts`: fetches roles plus agents and permissions.
- `generate-api-keys.ts`: fetches API keys.
- `generate-billing-plans.ts`: fetches billing plans and gracefully skips when billing is unavailable.

### Record generator

`generate-record-data.ts` currently only fetches records for these standard objects:

```text
company
person
task
note
timelineActivity
workspaceMember
connectedAccount
calendarEvent
```

Implication for XO Pure: if Storybook/tests need realistic XO Pure data, add XO Pure object names to `OBJECTS_TO_GENERATE` after the app is installed in the local workspace:

```text
xopureCustomer
xopureAmbassador
xopureOrder
xopureOrderLine
xopureProduct
xopureCommission
retailProspect
influencerProspect
xopureEnrichmentTask
```

Do not manually edit generated fixture files. Regenerate them from a known-good local workspace.

## Recommended Build Direction

Do not create a separate second CRM app yet. Extend `packages/twenty-apps/internal/xopure-crm` so the XO Pure domain model stays in one installable app.

The strongest next build is an Ambassador Revenue Operations layer:

1. Referral attribution ledger.
2. Payout batches and payout approval workflow.
3. Commission plans/rules.
4. Ambassador dashboard/page layouts.
5. Supabase sync writer and backfill tooling.

That adds real operating value without changing the core Twenty front end.

## Extension Ideas

### 1. Referral Attribution Ledger

Add `xopureReferralEvent` or `xopureReferralAttribution`.

Suggested fields:

- `eventType`: click, signup, first_purchase, repeat_purchase, refund, manual_adjustment.
- `status`: raw, matched, attributed, rejected, reversed.
- `referralCode`.
- `ambassadorExternalId`.
- `customerExternalId`.
- `orderExternalId`.
- `sourceUrl`.
- `utmSource`, `utmMedium`, `utmCampaign`.
- `occurredAt`.
- `matchedAt`.
- `revenueAmount`.
- `commissionableAmount`.
- `rejectionReason`.
- `sourcePayloadHash`.

Suggested relations:

- Many referral events to one ambassador.
- Many referral events to one customer.
- Many referral events to one order.
- One order to many referral events.

Why this matters: the current model jumps from code-on-order to commission. A ledger gives the team an auditable middle layer for "why did this ambassador get credit?"

### 2. Payout Batches

Add `xopurePayoutBatch` and relate commissions to batches.

Suggested fields:

- `name`.
- `periodStart`, `periodEnd`.
- `status`: draft, reviewing, approved, paid, failed, cancelled.
- `totalAmount`.
- `commissionCount`.
- `paymentProvider`.
- `providerBatchId`.
- `approvedBy`.
- `approvedAt`.
- `paidAt`.
- `notes`.

Add `payoutBatch` relation on `xopureCommission`.

Why this matters: `xopureCommission.status` can show individual state, but payment operations need batches, approvals, exports, and reconciliation.

### 3. Commission Plans And Tier Rules

Add `xopureCommissionPlan` or `xopureAmbassadorTierRule`.

Suggested fields:

- `name`.
- `tier`.
- `baseRate`.
- `productCategory`.
- `minimumCv`.
- `effectiveStart`, `effectiveEnd`.
- `isActive`.
- `ruleSummary`.

Why this matters: current ambassador `commissionRate` and commission `rate` are snapshots. Rules make the calculation explainable, versioned, and easier to change without losing history.

### 4. Ambassador Command Center

Use page layouts/front components to build an ambassador operating surface.

Useful widgets:

- Top ambassadors by attributed revenue.
- Pending payout amount by ambassador.
- Pending commission aging.
- First-sale activation queue.
- Ambassadors with no order in 30/60/90 days.
- Referral code collision/missing-code warnings.
- Recent referrals and orders timeline.

Why this matters: the team should not have to infer ambassador health from separate object tables.

### 5. Referral And Payout Queues

Add saved views for common workflows:

- Pending attribution review.
- Rejected attribution events.
- Commission pending approval.
- Commission approved but unpaid.
- Failed payout.
- Paid this period.
- Ambassadors missing referral codes.
- Orders with ambassador code but no commission.

These can be shipped before custom React widgets and will immediately improve operations.

### 6. Prospect-To-Ambassador Conversion

Formalize conversion from `influencerProspect` to `xopureAmbassador`.

Suggested logic function:

- `POST /xopure/prospects/convert-to-ambassador`

Suggested behavior:

- Validate prospect stage and required fields.
- Dedupe by email, handle, and external IDs.
- Create or update `person`.
- Create `xopureAmbassador`.
- Copy research summary, platform, handle, contact data, and priority score.
- Set `xopureCoreTags` and `xopureAmbassadorLevel`.
- Add an audit/referral event for conversion source.

Why this matters: it keeps prospecting separate while making successful conversion a first-class action.

### 7. Retail Prospect Pipeline

Add workflow around wholesale/retail outreach.

Useful additions:

- Retail account type: boutique, gym, wellness clinic, supplement shop, event, distributor.
- Fit score and disqualification reason.
- Sample kit sent date.
- Wholesale terms sent date.
- First wholesale order relation.
- Next follow-up due view.

Why this matters: retail prospects have different qualification criteria than creator/ambassador prospects.

### 8. Customer And Ambassador 360 Pages

Add record page layouts for:

- Customer: orders, order lines, referral source, LTV, last order, related commissions, lifecycle sequence status.
- Ambassador: profile, referral code, orders attributed, commissions, payout batches, tier history, research summary, recent activity.

This should live in the app package through page layouts and front components, not by hardcoding XO Pure-specific UI into `twenty-front`.

### 9. Sync Writer And Backfill

Replace the webhook stubs with concrete writes.

Suggested endpoints:

- `POST /xopure/sync/supabase`: idempotent webhook upsert.
- `POST /xopure/sync/backfill`: table/id or table/date-range backfill.
- `POST /xopure/sync/reconcile`: compare Supabase source counts/hashes to Twenty mirror counts.
- `POST /xopure/sync/retry-failed`: replay dead-lettered sync failures.

Use `supabase/migrations/202605070001_create_crm_sync_map.sql` as the source-to-Twenty mapping layer.

Minimum sync behavior:

- Upsert by source table + source ID.
- Store Twenty object name and record ID in `crm_sync_map`.
- Avoid duplicate records on retries.
- Record last sync attempt, last success, retry count, and error message.
- Never write directly to Twenty internal database tables.

### 10. Payment Reconciliation

Add a provider-neutral reconciliation object if payouts happen outside Twenty.

Suggested object: `xopurePaymentReconciliation`.

Suggested fields:

- `provider`.
- `providerPaymentId`.
- `providerBatchId`.
- `grossAmount`.
- `feeAmount`.
- `netAmount`.
- `status`.
- `paidAt`.
- `matchedCommissionCount`.
- `unmatchedReason`.

Why this matters: commission approval and actual cash movement are different events.

### 11. Lifecycle Automation Triggers

Use the existing `xopureAutomationTrigger` and `xopureEmailSequence` objects as the operator-visible registry, then add logic functions for the actual automation.

High-value triggers:

- Ambassador approved -> onboarding sequence.
- Ambassador first sale -> celebration and next-step sequence.
- Ambassador inactive 30 days -> reactivation sequence.
- Pending payout approved -> payout notification.
- Customer first order with referral -> referral thank-you sequence.
- VIP customer threshold crossed -> retention sequence.
- Retail prospect qualified -> wholesale outreach sequence.
- Influencer enriched and fit score high -> invite sequence.

Keep "registry/config" in CRM records and "execution" in logic functions.

### 12. Enrichment Work Queue

Complete `xopure-create-enrichment-task` so it actually creates queue records and updates the target record status.

Suggested behavior:

- Create `xopureEnrichmentTask`.
- Set target `xopureEnrichmentStatus` to queued.
- Let the research agent pick queued tasks.
- Write result summary, data confidence, and completed timestamp.
- Update prospect/customer/ambassador research fields only when confidence is adequate.

Useful extra fields:

- `sourceUrls`.
- `confidenceScore`.
- `assignedAgent`.
- `failureReason`.
- `lastAttemptAt`.

## Suggested Implementation Phases

### Phase 1: Operational Tables

Add:

- `xopureReferralEvent`.
- `xopurePayoutBatch`.
- `xopureCommissionPlan`.
- Relations from referral events to ambassadors/customers/orders.
- Relation from commissions to payout batches.
- Views for pending attribution, pending payout, failed payout, missing referral code, and orders missing commission.

### Phase 2: Real Sync

Implement:

- Production upsert writer in `xopure-supabase-sync-webhook`.
- Backfill endpoint.
- Sync failure/dead-letter tracking.
- Tests around normalization and idempotency.

### Phase 3: Operator UI

Add:

- Ambassador dashboard page layout.
- Ambassador record page components.
- Customer 360 page components.
- Payout approval/export component.
- Referral timeline component.

### Phase 4: Automations

Add:

- Prospect conversion function.
- Enrichment task creation/update function.
- Commission calculation/recalculation function.
- Payout batch creation and approval flow.
- Lifecycle automation trigger execution.

## Concrete First Slice

The best first slice is:

1. Create `xopureReferralEvent`.
2. Create `xopurePayoutBatch`.
3. Relate referral events to ambassador, customer, and order.
4. Relate commissions to payout batch.
5. Add views for:
   - Referral Events Needing Review.
   - Orders With Ambassador Code And No Commission.
   - Pending Commission Approval.
   - Approved Commissions Awaiting Payout.
   - Paid Commissions This Period.
6. Update the Supabase sync normalizer to emit referral/attribution candidates when orders include `affiliate_chain` or ambassador codes.
7. Add tests for referral code extraction, commissionable order detection, and duplicate prevention.

This creates a useful operating layer immediately, and it gives later dashboard widgets real data to display.

## Notes For Front-End Testing

If XO Pure-specific front-end components are added to the app package, keep the app UI inside `packages/twenty-apps/internal/xopure-crm` unless the behavior is generic enough for core Twenty.

For local Twenty front-end fixture generation:

- Install the XO Pure app in the local workspace first.
- Run `npx nx run twenty-front:mock:generate`.
- Add XO Pure object names to `OBJECTS_TO_GENERATE` only if tests need actual record fixtures, not just metadata.
- Review generated diffs carefully because mock metadata can be large and noisy.

## Decision

Extend the existing XO Pure app package. The current schema already models the domain; the next value comes from making attribution and payouts auditable, completing sync/backfill, and adding operator-focused views and page layouts.
