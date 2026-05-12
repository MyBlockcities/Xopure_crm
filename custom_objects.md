# XO Pure Twenty CRM — Custom Object Specification

## 0. Conventions

Use Twenty's standard objects where they fit. Twenty ships with **Task, Note, Activity, Person, Company, Opportunity**.

- **Keep:** `Task`, `Note`, `Activity` — used as-is across XO Pure objects (any object can attach Tasks/Notes/Activities).
- **Override:** `Person` and `Company` are replaced by domain-specific `Customer` and `Account` objects below. We don't extend `Person`/`Company`; we use independent custom objects so visibility scoping and field-level masking are easier to enforce and so Supabase sync stays clean.
- **Skip:** `Opportunity` — XO Pure's ambassador motion is rank-driven, not deal-driven. Pipeline progress lives on `Ambassador.onboardingStage` instead.

### Field type legend (Twenty native types used below)

`UUID`, `TEXT`, `NUMBER`, `NUMERIC`, `BOOLEAN`, `DATE`, `DATE_TIME`,
`SELECT`, `MULTI_SELECT`, `CURRENCY`, `RICH_TEXT`, `RAW_JSON`,
`FULL_NAME`, `EMAILS`, `PHONES`, `ADDRESS`, `LINKS`,
`RELATION (MANY_TO_ONE | ONE_TO_MANY | MANY_TO_MANY)`.

### Source-of-truth model

| Sync direction | Meaning |
| --- | --- |
| **Read-only** | Field is written by the Supabase → Twenty sync; the Twenty UI must not allow edits. Editing in Twenty is silently discarded on next sync. |
| **Read mostly** | Most fields are sync-owned; a small set of CRM workflow fields (notes, tags, ownership, onboarding stage) are writable in Twenty and never overwritten by sync. |
| **Twenty-owned** | Field lives only in Twenty. Sync never touches it. |

### Naming

- Object `nameSingular`: lowerCamel (e.g. `ambassador`, `commissionLine`).
- Field names: lowerCamel.
- Code/identifier text fields use `Code` suffix (`ambassadorCode`, `orderCode`, `batchCode`).
- Supabase primary keys are mirrored as `supabaseId UUID` on every synced object. Unique index enforced in workspace schema.

### Workspace target

All objects are created in workspace `workspace_5pedu4dl120j0zsebvp6nap5w` (`Xopure`) on `crm.xopure.com`.

### Creation order (dependency-aware)

Created later objects reference earlier ones via `MANY_TO_ONE`. The setup script must run in this order:

1. `compPlanVersion`
2. `period`
3. `account`
4. `product`
5. `ambassador` (self-ref `sponsor` added in a second pass)
6. `customer`
7. `affiliateClick`
8. `order`
9. `orderItem`
10. `paymentAttempt`
11. `manualPaymentSubmission`
12. `shipment`
13. `shippingEvent`
14. `commissionLine`
15. `payoutBatch`
16. `payoutBatchItem`
17. `reconciliationException`

---

## 1. Ambassador

**Twenty config:** `nameSingular: ambassador` · `icon: IconUserCheck`
**Source of truth:** Supabase `affiliates` table
**Sync direction:** Read mostly; relationship/workflow fields writable in Twenty
**Purpose:** Core registry of every ambassador in the network. Identity, sponsor chain, status, and current-period rollup metrics.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | Unique sync key |
| `ambassadorCode` | TEXT | No | Supabase | "A001" style |
| `fullName` | FULL_NAME | No | Supabase | First + last |
| `emails` | EMAILS | No | Supabase | Composite |
| `phones` | PHONES | No | Supabase | Composite |
| `path` | SELECT | No | Supabase | `standard` / `elite` / `referral` |
| `sponsor` | RELATION (MANY_TO_ONE) | No | Supabase | → Ambassador (self-ref) |
| `enrolledAt` | DATE_TIME | No | Supabase | — |
| `qualifiedRank` | SELECT | No | Supabase | `L0_customer` through `L6_icon` |
| `eliteMaintained` | BOOLEAN | No | Supabase | Calculated monthly |
| `customerCV` | CURRENCY | No | Supabase | Current period |
| `groupCV` | CURRENCY | No | Supabase | Current period |
| `personalOrderCV` | CURRENCY | No | Supabase | Current period |
| `activeCustomerCount` | NUMBER | No | Supabase | — |
| `personalEnrollments` | NUMBER | No | Supabase | — |
| `currentTier` | SELECT | No | Computed | `tier1` through `tier4` |
| `onboardingStage` | SELECT | Yes | Twenty | `invited` / `enrolled` / `trained` / `active` / `coach_needed` / `dormant` |
| `relationshipOwner` | RELATION | Yes | Twenty | → User (XO team member) |
| `tags` | MULTI_SELECT | Yes | Twenty | Free-form |
| `internalNotes` | RICH_TEXT | Yes | Twenty | Ops team notes |
| `communicationPreferences` | MULTI_SELECT | Yes | Twenty | `email` / `sms` / `call` / `do_not_contact` |
| `complianceHoldReason` | TEXT | Yes | Twenty | Admin-only |

**Relations**

- Has many: Customers (as referrer), Orders (as referringAmbassador), CommissionLines (as earningAmbassador), PayoutBatchItems, AffiliateClicks, Tasks, Notes.
- Belongs to: Sponsor (self-ref), `relationshipOwner` (User), `currentPeriod` (Period) — denormalized rollup pointer.

**Key behaviors**

- Visibility scoping enforced in Twenty by a workspace member's `ambassador_id`. Reps see their own row + L1 downline rows in full; L2–L3 with redacted fields; L4+ aggregates only (per the Q3 visibility rules we settled on).
- `qualifiedRank` change triggers a Slack alert to ops on promotion or demotion.

---

## 2. Customer

**Twenty config:** `nameSingular: customer` · `icon: IconUserCircle`
**Source of truth:** Supabase `customers` table
**Sync direction:** Read mostly
**Purpose:** End customers who purchase products. Distinct from Ambassador. PII is access-controlled by referring relationship.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `customerCode` | TEXT | No | Supabase | "C001" style |
| `fullName` | FULL_NAME | No | Supabase | — |
| `emails` | EMAILS | No | Supabase | Visible only to direct ambassador |
| `phones` | PHONES | No | Supabase | Same restriction |
| `shippingAddress` | ADDRESS | No | Supabase | Same restriction |
| `referrer` | RELATION (MANY_TO_ONE) | No | Supabase | → Ambassador |
| `account` | RELATION (MANY_TO_ONE) | No | Supabase | → Account (nullable; B2B/wholesale only) |
| `enrolledAt` | DATE_TIME | No | Supabase | — |
| `isActive` | BOOLEAN | No | Supabase | Last order < 60 days |
| `lifetimeCV` | CURRENCY | No | Supabase | Sum of all order CV |
| `lastOrderAt` | DATE_TIME | No | Supabase | — |
| `orderCount` | NUMBER | No | Supabase | Lifetime |
| `subscriptionStatus` | SELECT | No | Supabase | `none` / `active` / `paused` / `cancelled` |
| `customerNotes` | RICH_TEXT | Yes | Twenty | Direct ambassador only |
| `tags` | MULTI_SELECT | Yes | Twenty | — |
| `communicationPreferences` | MULTI_SELECT | Yes | Twenty | — |

**Relations**

- Belongs to: Referrer (Ambassador), Account (optional).
- Has many: Orders, Shipments (via Order), Notes, Tasks.

**Key behaviors**

- Field-level visibility: if the requesting user's `ambassador_id ≠ customer.referrer_id`, the `emails`/`phones`/`shippingAddress` fields return masked values (`j***@email.com`). Twenty's permission system needs a custom resolver for this — it's not native.

---

## 3. Account

**Twenty config:** `nameSingular: account` · `icon: IconBuildingStore`
**Source of truth:** Supabase `accounts` table
**Sync direction:** Read mostly; CRM workflow fields Twenty-owned
**Purpose:** Replaces Twenty's `Company`. Represents a household, business, or wholesale buyer that may own multiple Customer records and route to shared billing/shipping.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `accountCode` | TEXT | No | Supabase | "ACC-0001" style |
| `name` | TEXT | No | Supabase | Display name |
| `accountType` | SELECT | No | Supabase | `residential` / `business` / `wholesale` / `medical_practice` |
| `primaryContact` | RELATION (MANY_TO_ONE) | No | Supabase | → Customer |
| `billingAddress` | ADDRESS | No | Supabase | — |
| `shippingAddress` | ADDRESS | No | Supabase | — |
| `taxId` | TEXT | No | Supabase | Admin-only field-level permission |
| `creditTermsDays` | NUMBER | No | Supabase | 0 = prepay |
| `wholesalePricingTier` | SELECT | No | Supabase | `none` / `bronze` / `silver` / `gold` |
| `annualVolume` | CURRENCY | No | Supabase | Rolling 12-month |
| `relationshipOwner` | RELATION | Yes | Twenty | → User |
| `onboardingStage` | SELECT | Yes | Twenty | `prospect` / `applied` / `approved` / `active` / `on_hold` |
| `accountNotes` | RICH_TEXT | Yes | Twenty | — |
| `tags` | MULTI_SELECT | Yes | Twenty | — |

**Relations**

- Has many: Customers, Orders (via Customer), Tasks, Notes.
- Belongs to: `relationshipOwner` (User), `primaryContact` (Customer).

**Key behaviors**

- `taxId` is admin-only — non-admin workspace members cannot read it.
- An Account aggregates LTV/CV across all child Customers for the Account dashboard view.

---

## 4. Product

**Twenty config:** `nameSingular: product` · `icon: IconBottle`
**Source of truth:** Supabase `products` table
**Sync direction:** Read-only
**Purpose:** Catalog of physical and digital products available for purchase. Defines commission eligibility and CV rates.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `sku` | TEXT | No | Supabase | Unique |
| `name` | TEXT | No | Supabase | — |
| `description` | RICH_TEXT | No | Supabase | — |
| `productType` | SELECT | No | Supabase | `subscription` / `one_time` / `sample` / `kit` / `digital` |
| `category` | SELECT | No | Supabase | `peptide` / `supplement` / `device` / `apparel` / `bundle` |
| `retailPrice` | CURRENCY | No | Supabase | — |
| `wholesalePrice` | CURRENCY | No | Supabase | Ambassador price |
| `cv` | CURRENCY | No | Supabase | Commission value — usually `retailPrice × 0.5` |
| `isActive` | BOOLEAN | No | Supabase | — |
| `launchedAt` | DATE_TIME | No | Supabase | — |
| `discontinuedAt` | DATE_TIME | No | Supabase | Nullable |
| `imageUrl` | TEXT | No | Supabase | — |
| `commissionable` | BOOLEAN | No | Supabase | False for samples/free items |
| `starterKit` | BOOLEAN | No | Supabase | Counts toward Fast Start unlock |
| `internalNotes` | RICH_TEXT | Yes | Twenty | Ops/training notes |

**Relations**

- Has many: OrderItems, Orders (via OrderItem).

**Key behaviors**

- `cv` × `quantity` is the basis for commission calculations.
- Marking `isActive = false` blocks new orders but keeps history.

---

## 5. Period

**Twenty config:** `nameSingular: period` · `icon: IconCalendarStats`
**Source of truth:** Supabase `comp_periods` table
**Sync direction:** Read-only
**Purpose:** Accounting period (monthly + weekly). Every Order, CommissionLine, and PayoutBatch is bound to a period.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `periodCode` | TEXT | No | Supabase | `2026-05` or `2026-W19` |
| `periodType` | SELECT | No | Supabase | `monthly` / `weekly` |
| `startsAt` | DATE_TIME | No | Supabase | Inclusive |
| `endsAt` | DATE_TIME | No | Supabase | Exclusive |
| `status` | SELECT | No | Supabase | `open` / `closed` / `finalized` |
| `closedAt` | DATE_TIME | No | Supabase | When period locked |
| `closedBy` | RELATION | No | Supabase | → User |
| `totalCV` | CURRENCY | No | Supabase | Sum of paid order CV |
| `totalCommissions` | CURRENCY | No | Supabase | Sum of payable commission lines |
| `totalPayouts` | CURRENCY | No | Supabase | Sum of paid payout batches |
| `notes` | RICH_TEXT | Yes | Twenty | Finance notes |

**Relations**

- Has many: Orders, CommissionLines, PayoutBatches.
- Belongs to: `closedBy` (User).

**Key behaviors**

- `finalized` periods reject any retroactive sync changes — the script logs a reconciliation exception instead of mutating.

---

## 6. Order

**Twenty config:** `nameSingular: order` · `icon: IconShoppingCart`
**Source of truth:** Supabase `orders` table
**Sync direction:** Read-only
**Purpose:** Every transaction. Links Customer → Ambassador → Commission Lines.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `orderCode` | TEXT | No | Supabase | "O1001" style |
| `customer` | RELATION (MANY_TO_ONE) | No | Supabase | → Customer |
| `referringAmbassador` | RELATION (MANY_TO_ONE) | No | Supabase | → Ambassador |
| `period` | RELATION (MANY_TO_ONE) | No | Supabase | → Period |
| `compPlanVersion` | RELATION (MANY_TO_ONE) | No | Supabase | → CompPlanVersion (snapshot) |
| `orderedAt` | DATE_TIME | No | Supabase | — |
| `settledAt` | DATE_TIME | No | Supabase | `orderedAt + refundHoldDays` |
| `status` | SELECT | No | Supabase | `pending` / `paid` / `shipped` / `delivered` / `refunded` / `chargeback` |
| `totalRetail` | CURRENCY | No | Supabase | Sum of order item line totals |
| `totalCV` | CURRENCY | No | Supabase | Sum of order item CV |
| `paymentMethod` | SELECT | No | Supabase | `stripe` / `paypal` / `manual_venmo` / `manual_cashapp` / `manual_wire` / `invoice` / `crypto` |
| `primaryPaymentAttempt` | RELATION (MANY_TO_ONE) | No | Supabase | → PaymentAttempt (the one that succeeded) |
| `isPersonalOrder` | BOOLEAN | No | Supabase | Customer = Ambassador own purchase |
| `fraudScore` | NUMBER | No | Supabase | 0–100, calculated |
| `fraudFlagged` | BOOLEAN | No | Supabase | Routes to review queue |
| `attributionSnapshot` | RAW_JSON | No | Supabase | Frozen upline chain at order time |

**Relations**

- Belongs to: Customer, Referring Ambassador, Period, CompPlanVersion, primaryPaymentAttempt.
- Has many: OrderItems, PaymentAttempts, CommissionLines (typically 4–8 per order), Shipments.

**Key behaviors**

- An order triggers 1 commission line per qualified upline level. Sarah orders → L1 Sarah, L2 sponsor, L3 grandsponsor, L4, plus Gens 1–4 = up to 8 commission lines per order.
- Refund updates `status = refunded` and triggers reversal commission lines (negative amounts).
- `attributionSnapshot` is immutable after creation — protects commissions against later sponsor changes.

---

## 7. OrderItem

**Twenty config:** `nameSingular: orderItem` · `icon: IconReceipt2`
**Source of truth:** Supabase `order_items` table
**Sync direction:** Read-only
**Purpose:** Line item per Order. Allows multi-product orders and per-line CV calculations.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `order` | RELATION (MANY_TO_ONE) | No | Supabase | → Order |
| `product` | RELATION (MANY_TO_ONE) | No | Supabase | → Product |
| `quantity` | NUMBER | No | Supabase | — |
| `unitPrice` | CURRENCY | No | Supabase | At order time |
| `unitCV` | CURRENCY | No | Supabase | At order time |
| `lineTotal` | CURRENCY | No | Supabase | `unitPrice × quantity − discountAmount` |
| `lineCV` | CURRENCY | No | Supabase | `unitCV × quantity` |
| `isSubscription` | BOOLEAN | No | Supabase | Was this line a recurring sub? |
| `discountAmount` | CURRENCY | No | Supabase | — |
| `discountReason` | TEXT | No | Supabase | Promo code, loyalty, etc. |

**Relations**

- Belongs to: Order, Product.

**Key behaviors**

- Order-item CV is the basis for commission line generation; never recompute from current Product CV.

---

## 8. Commission Line

**Twenty config:** `nameSingular: commissionLine` · `icon: IconCoin`
**Source of truth:** Supabase `commission_ledger` table
**Sync direction:** Read-only
**Purpose:** Individual commission entry: one ambassador, one order, one level, one calculated amount. The granular audit trail.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `order` | RELATION (MANY_TO_ONE) | No | Supabase | → Order |
| `earningAmbassador` | RELATION (MANY_TO_ONE) | No | Supabase | → Ambassador |
| `period` | RELATION (MANY_TO_ONE) | No | Supabase | → Period |
| `compPlanVersion` | RELATION (MANY_TO_ONE) | No | Supabase | → CompPlanVersion |
| `commissionType` | SELECT | No | Supabase | `tiered_l1` / `l2` / `l3` / `l4` / `gen_1` / `gen_2` / `gen_3` / `gen_4` / `milestone_bronze` / `milestone_silver` / `milestone_gold` / `fast_start` |
| `commissionLevel` | NUMBER | No | Supabase | 1–8 (depth) |
| `baseCV` | CURRENCY | No | Supabase | The CV this commission was calculated against |
| `rate` | NUMERIC | No | Supabase | 0.30, 0.10, 0.04 etc. |
| `tierBracket` | SELECT | No | Supabase | For `tiered_l1` only: `t1` / `t2` / `t3` / `t4` |
| `amount` | CURRENCY | No | Supabase | Actual $ earned |
| `status` | SELECT | No | Supabase | `held` / `payable` / `paid` / `reversed` |
| `heldUntil` | DATE_TIME | No | Supabase | `settledAt + refundHoldDays` |
| `compressionApplied` | BOOLEAN | No | Supabase | True if gen pay paid this person via dynamic compression |
| `skippedAncestors` | RAW_JSON | No | Supabase | If compressed, who was skipped and why |
| `payoutBatch` | RELATION (MANY_TO_ONE) | No | Supabase | → PayoutBatch (null until paid) |

**Relations**

- Belongs to: Order, Earning Ambassador, Period, CompPlanVersion, PayoutBatch.

**Key behaviors**

- Status `held → payable` flip happens automatically once `heldUntil` passes (Supabase job, not Twenty).
- Reversals are new rows with negative `amount`, linked to the original via `supabaseId` foreign-key on the Supabase side.

---

## 9. CompPlanVersion

**Twenty config:** `nameSingular: compPlanVersion` · `icon: IconScale`
**Source of truth:** Supabase `comp_plan_versions` table
**Sync direction:** Read-only
**Purpose:** Versioned commission plan rules. Every Order and CommissionLine references the plan version that was active at order time — protects against retroactive plan changes.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `versionCode` | TEXT | No | Supabase | "v2026.05" |
| `effectiveFrom` | DATE_TIME | No | Supabase | — |
| `effectiveTo` | DATE_TIME | No | Supabase | Null = current |
| `status` | SELECT | No | Supabase | `draft` / `active` / `superseded` |
| `l1Rate` | NUMERIC | No | Supabase | Direct sale |
| `l2Rate` | NUMERIC | No | Supabase | First upline |
| `l3Rate` | NUMERIC | No | Supabase | Second upline |
| `l4Rate` | NUMERIC | No | Supabase | Third upline |
| `gen1Rate` | NUMERIC | No | Supabase | Generation 1 |
| `gen2Rate` | NUMERIC | No | Supabase | Generation 2 |
| `gen3Rate` | NUMERIC | No | Supabase | Generation 3 |
| `gen4Rate` | NUMERIC | No | Supabase | Generation 4 |
| `tierBrackets` | RAW_JSON | No | Supabase | `{t1: {min:0, max:5000, rate:0.30}, ...}` |
| `milestoneRules` | RAW_JSON | No | Supabase | Bronze/silver/gold thresholds + rates |
| `fastStartWindowDays` | NUMBER | No | Supabase | Days to qualify for Fast Start bonus |
| `refundHoldDays` | NUMBER | No | Supabase | Default commission hold (e.g. 7) |
| `changeReason` | RICH_TEXT | No | Supabase | Why this version supersedes the prior |
| `approvedBy` | RELATION | No | Supabase | → User |

**Relations**

- Has many: Orders, CommissionLines.
- Belongs to: `approvedBy` (User).

**Key behaviors**

- Only one row may have `status = active` at a time. Setup script verifies this invariant.
- `superseded` rows must be preserved for audit — never deleted.

---

## 10. Shipment

**Twenty config:** `nameSingular: shipment` · `icon: IconTruckDelivery`
**Source of truth:** Supabase `shipments` table
**Sync direction:** Read-only
**Purpose:** Fulfillment record per order. One Shipment per physical Order; digital orders skip Shipment entirely.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `order` | RELATION (MANY_TO_ONE) | No | Supabase | → Order |
| `shippingProvider` | SELECT | No | Supabase | `shipstation` / `manual` / `other` |
| `externalOrderId` | TEXT | No | Supabase | Provider's order ID |
| `shipmentId` | TEXT | No | Supabase | Provider's shipment ID |
| `carrier` | SELECT | No | Supabase | `usps` / `ups` / `fedex` / `dhl` / `other` |
| `serviceLevel` | SELECT | No | Supabase | `ground` / `priority` / `express` / `overnight` |
| `trackingNumber` | TEXT | No | Supabase | — |
| `trackingUrl` | TEXT | No | Supabase | Customer-facing |
| `labelUrl` | TEXT | No | Supabase | Admin reference |
| `shippingStatus` | SELECT | No | Supabase | `pending` / `label_created` / `shipped` / `in_transit` / `delivered` / `exception` / `returned` |
| `shippedAt` | DATE_TIME | No | Supabase | — |
| `estimatedDelivery` | DATE_TIME | No | Supabase | — |
| `deliveredAt` | DATE_TIME | No | Supabase | — |
| `shippingCost` | CURRENCY | No | Supabase | — |
| `weightOz` | NUMBER | No | Supabase | — |
| `exceptionReason` | TEXT | No | Supabase | Set when status = `exception` |
| `rawPayload` | RAW_JSON | No | Supabase | Provider's last full payload |

**Relations**

- Belongs to: Order.
- Has many: ShippingEvents.

**Key behaviors**

- Status `exception` automatically creates a Twenty Task assigned to ops (workflow).

---

## 11. ShippingEvent

**Twenty config:** `nameSingular: shippingEvent` · `icon: IconRoute`
**Source of truth:** Supabase `shipping_events` table
**Sync direction:** Read-only
**Purpose:** Granular event history per Shipment. Captures every webhook update from the carrier.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `shipment` | RELATION (MANY_TO_ONE) | No | Supabase | → Shipment |
| `eventType` | SELECT | No | Supabase | `label_created` / `picked_up` / `in_transit` / `out_for_delivery` / `delivered` / `exception` / `returned` |
| `eventTimestamp` | DATE_TIME | No | Supabase | Carrier-reported time |
| `location` | TEXT | No | Supabase | Scan location |
| `carrierStatusCode` | TEXT | No | Supabase | Raw code |
| `description` | TEXT | No | Supabase | Human-readable |
| `rawPayload` | RAW_JSON | No | Supabase | Full webhook payload |

**Relations**

- Belongs to: Shipment.

**Key behaviors**

- Append-only — never updated or deleted.

---

## 12. PaymentAttempt

**Twenty config:** `nameSingular: paymentAttempt` · `icon: IconCreditCard`
**Source of truth:** Supabase `payment_attempts` table
**Sync direction:** Read-only
**Purpose:** Every payment attempt against an Order (including failed and retry attempts). Supports the merchant-router model — one Order may have multiple PaymentAttempts across different providers.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `order` | RELATION (MANY_TO_ONE) | No | Supabase | → Order |
| `provider` | SELECT | No | Supabase | `stripe` / `paypal` / `manual_venmo` / `manual_cashapp` / `manual_wire` / `invoice` / `crypto` / `other` |
| `providerStatus` | SELECT | No | Supabase | `initiated` / `pending` / `succeeded` / `failed` / `refunded` / `disputed` / `chargeback` |
| `amount` | CURRENCY | No | Supabase | Attempted amount |
| `currency` | TEXT | No | Supabase | ISO 4217 (default USD) |
| `providerPaymentIntentId` | TEXT | No | Supabase | Stripe PI / PayPal order ID / etc. |
| `providerChargeId` | TEXT | No | Supabase | Post-capture ID |
| `failureReason` | TEXT | No | Supabase | Set on `failed` |
| `attemptedAt` | DATE_TIME | No | Supabase | — |
| `settledAt` | DATE_TIME | No | Supabase | When funds confirmed |
| `routingRuleApplied` | TEXT | No | Supabase | Which routing rule selected this provider |
| `isPrimaryAttempt` | BOOLEAN | No | Supabase | True for the attempt that became the order's success |
| `rawWebhookPayload` | RAW_JSON | No | Supabase | — |

**Relations**

- Belongs to: Order.
- Has many: ManualPaymentSubmissions (when provider = `manual_*`).

**Key behaviors**

- A successful `PaymentAttempt` flips `Order.status` to `paid` and triggers commission generation.

---

## 13. ManualPaymentSubmission

**Twenty config:** `nameSingular: manualPaymentSubmission` · `icon: IconClipboardCheck`
**Source of truth:** Supabase `manual_payment_submissions` table
**Sync direction:** Read mostly; admin review fields writable in Twenty (via dedicated workflow, not freeform)
**Purpose:** Admin review queue for Venmo / Cash App / wire / Zelle / check / cash payments. One submission per customer claim of payment.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `order` | RELATION (MANY_TO_ONE) | No | Supabase | → Order |
| `paymentAttempt` | RELATION (MANY_TO_ONE) | No | Supabase | → PaymentAttempt |
| `method` | SELECT | No | Supabase | `venmo` / `cashapp` / `wire` / `zelle` / `check` / `cash` |
| `submittedAmount` | CURRENCY | No | Supabase | What customer claimed they paid |
| `submitterReference` | TEXT | No | Supabase | Venmo handle, txn id, check #, etc. |
| `screenshotUrl` | TEXT | No | Supabase | Customer-uploaded proof |
| `customerNote` | RICH_TEXT | No | Supabase | Customer's own comment |
| `submittedAt` | DATE_TIME | No | Supabase | — |
| `reviewStatus` | SELECT | Yes | Twenty | `pending` / `approved` / `rejected` / `needs_info` |
| `reviewedBy` | RELATION | Yes | Twenty | → User |
| `reviewedAt` | DATE_TIME | Yes | Twenty | Set on review save |
| `reviewerNote` | RICH_TEXT | Yes | Twenty | Internal — never shown to customer |
| `rejectionReason` | TEXT | Yes | Twenty | If `rejected` |

**Relations**

- Belongs to: Order, PaymentAttempt, `reviewedBy` (User).

**Key behaviors**

- Approving a submission writes back to Supabase (Twenty → Supabase, opposite of default sync direction). Supabase then flips the PaymentAttempt to `succeeded`.
- Rejection sends a transactional email to the customer via Resend.

---

## 14. PayoutBatch

**Twenty config:** `nameSingular: payoutBatch` · `icon: IconCash`
**Source of truth:** Supabase `payout_batches` table
**Sync direction:** Read mostly; approval fields writable in Twenty
**Purpose:** Batched commission payouts for a period. One PayoutBatch per (period × payout method).

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `batchCode` | TEXT | No | Supabase | "PB-2026-05" |
| `period` | RELATION (MANY_TO_ONE) | No | Supabase | → Period |
| `payoutMethod` | SELECT | No | Supabase | `ach` / `paypal` / `check` / `wire` / `crypto` / `manual` |
| `status` | SELECT | No | Supabase | `draft` / `pending_approval` / `approved` / `processing` / `paid` / `failed` / `partially_paid` |
| `totalAmount` | CURRENCY | No | Supabase | Sum of items |
| `itemCount` | NUMBER | No | Supabase | Distinct ambassadors |
| `providerBatchId` | TEXT | No | Supabase | External payout provider reference |
| `scheduledFor` | DATE_TIME | No | Supabase | Target send time |
| `processedAt` | DATE_TIME | No | Supabase | When sent |
| `approvedBy` | RELATION | Yes | Twenty | → User |
| `approvedAt` | DATE_TIME | Yes | Twenty | Set when approval workflow runs |
| `batchNotes` | RICH_TEXT | Yes | Twenty | Finance notes |

**Relations**

- Belongs to: Period, `approvedBy` (User).
- Has many: PayoutBatchItems, CommissionLines.

**Key behaviors**

- `pending_approval → approved` requires Twenty workflow with admin role check. Write-back to Supabase triggers the actual payout job.

---

## 15. PayoutBatchItem

**Twenty config:** `nameSingular: payoutBatchItem` · `icon: IconReceiptDollar`
**Source of truth:** Supabase `payout_batch_items` table
**Sync direction:** Read-only
**Purpose:** One line per ambassador per payout batch. Roll-up of all commission lines being paid in this batch to that ambassador.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `payoutBatch` | RELATION (MANY_TO_ONE) | No | Supabase | → PayoutBatch |
| `ambassador` | RELATION (MANY_TO_ONE) | No | Supabase | → Ambassador |
| `amount` | CURRENCY | No | Supabase | Sum of included commission lines |
| `commissionLineCount` | NUMBER | No | Supabase | How many CLs rolled up |
| `status` | SELECT | No | Supabase | `pending` / `sent` / `paid` / `failed` / `held` / `reversed` |
| `providerTransferId` | TEXT | No | Supabase | ACH/PayPal/etc. transfer ref |
| `failureReason` | TEXT | No | Supabase | — |
| `holdReason` | TEXT | No | Supabase | Missing tax/payout info, compliance, etc. |
| `paidAt` | DATE_TIME | No | Supabase | — |

**Relations**

- Belongs to: PayoutBatch, Ambassador.

**Key behaviors**

- `held` items block the entire batch from progressing to `paid` — surfaced in the admin dashboard as action items.

---

## 16. ReconciliationException

**Twenty config:** `nameSingular: reconciliationException` · `icon: IconAlertTriangle`
**Source of truth:** Supabase `reconciliation_exceptions` table (output of daily recon job)
**Sync direction:** Read mostly; resolution fields writable in Twenty
**Purpose:** Findings from the daily reconciliation job (orders vs payments, paid orders without commissions, shipments without tracking emails, etc.). The CRM's operator dashboard surfaces these.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `reconciliationRunDate` | DATE | No | Supabase | The run that found it |
| `checkType` | SELECT | No | Supabase | `payment_order_mismatch` / `manual_payment_pending` / `missing_commission` / `missing_shipment` / `missing_tracking_email` / `refund_no_reversal` / `payout_mismatch` / `processor_settlement_mismatch` / `crm_sync_failure` |
| `severity` | SELECT | No | Supabase | `info` / `warning` / `error` / `critical` |
| `entityType` | SELECT | No | Supabase | `order` / `payment_attempt` / `commission_line` / `shipment` / `payout_batch` |
| `entityId` | TEXT | No | Supabase | Source row UUID |
| `description` | RICH_TEXT | No | Supabase | What's wrong |
| `detectedAt` | DATE_TIME | No | Supabase | — |
| `relatedOrder` | RELATION (MANY_TO_ONE) | No | Supabase | → Order (nullable) |
| `relatedAmbassador` | RELATION (MANY_TO_ONE) | No | Supabase | → Ambassador (nullable) |
| `payload` | RAW_JSON | No | Supabase | Snapshot of the mismatched data |
| `status` | SELECT | Yes | Twenty | `open` / `investigating` / `resolved` / `false_positive` / `wont_fix` |
| `resolvedBy` | RELATION | Yes | Twenty | → User |
| `resolvedAt` | DATE_TIME | Yes | Twenty | — |
| `resolutionNote` | RICH_TEXT | Yes | Twenty | — |

**Relations**

- Belongs to: Order (optional), Ambassador (optional), `resolvedBy` (User).

**Key behaviors**

- `critical` exceptions auto-create a Twenty Task assigned to ops via workflow.
- Daily digest email (Resend) summarizes new exceptions overnight.

---

## 17. AffiliateClick

**Twenty config:** `nameSingular: affiliateClick` · `icon: IconClick`
**Source of truth:** Supabase `affiliate_clicks` table
**Sync direction:** Read-only
**Purpose:** Referral attribution tracking. Each click on a `/r/{slug}` or `?ref={code}` URL creates a row; conversion link gets filled when the visitor places an order within the attribution window.

| Field | Type | Editable | Source | Notes |
| --- | --- | --- | --- | --- |
| `supabaseId` | UUID | No | Supabase | — |
| `ambassador` | RELATION (MANY_TO_ONE) | No | Supabase | → Ambassador |
| `referralCode` | TEXT | No | Supabase | Tracking code at click time |
| `referralSlug` | TEXT | No | Supabase | Pretty URL slug at click time |
| `landingPath` | TEXT | No | Supabase | Path on xopure.com |
| `referrerUrl` | TEXT | No | Supabase | HTTP referer header |
| `visitorFingerprint` | TEXT | No | Supabase | Cookie/device hash |
| `ipAddress` | TEXT | No | Supabase | PII — admin-only |
| `userAgent` | TEXT | No | Supabase | — |
| `countryCode` | TEXT | No | Supabase | Geo lookup |
| `utmSource` | TEXT | No | Supabase | — |
| `utmCampaign` | TEXT | No | Supabase | — |
| `utmMedium` | TEXT | No | Supabase | — |
| `clickedAt` | DATE_TIME | No | Supabase | — |
| `attributionExpiresAt` | DATE_TIME | No | Supabase | `clickedAt + attribution window` |
| `convertedAt` | DATE_TIME | No | Supabase | Set when click drives an order |
| `convertedOrder` | RELATION (MANY_TO_ONE) | No | Supabase | → Order (nullable) |
| `isBotFiltered` | BOOLEAN | No | Supabase | True for filtered/excluded traffic |

**Relations**

- Belongs to: Ambassador, Order (optional, on conversion).

**Key behaviors**

- `ipAddress` is admin-only and excluded from non-admin views.
- High-cardinality table — Twenty list view should default to "last 30 days" + indexed filters on `ambassador`.

---

## Appendix A — Relation graph

```
ambassador (self-ref: sponsor)
  ├─< customer (referrer)
  │   └─< order (customer)
  │       ├─< orderItem (order → product)
  │       ├─< paymentAttempt (order)
  │       │   └─< manualPaymentSubmission (paymentAttempt)
  │       ├─< shipment (order)
  │       │   └─< shippingEvent (shipment)
  │       └─< commissionLine (order → earningAmbassador, period, compPlanVersion, payoutBatch)
  ├─< affiliateClick (ambassador → convertedOrder)
  └─< payoutBatchItem (ambassador → payoutBatch → period)

account
  └─< customer (account)

period
  ├─< order
  ├─< commissionLine
  └─< payoutBatch
        └─< payoutBatchItem

compPlanVersion
  ├─< order
  └─< commissionLine

reconciliationException
  ├─> order (optional)
  └─> ambassador (optional)
```

## Appendix B — Open questions for review

1. **Should `Account` exist at all in v1?** All current XO Pure customers are residential — Accounts only matter once wholesale/B2B onboarding ships. Could defer.
2. **Subscription as its own object?** Currently modeled as `subscriptionStatus` on Customer + `isSubscription` on OrderItem. A first-class Subscription object would help if we want lifecycle workflows (pause, skip, cancel surveys). Not in this 17-object set.
3. **RankAchievement object?** Currently `qualifiedRank` is a SELECT on Ambassador (current value only). A RankAchievement history table would give us promotion-date analytics and the Slack alert hook. Could add as #18.
4. **Refund object?** Currently modeled as `Order.status = refunded` + negative-amount CommissionLines. A dedicated Refund object would help if we need partial refunds or refund reasons. Not in this set.
5. **Twenty-side field-level masking** (Customer PII, Account taxId, AffiliateClick.ipAddress) isn't native. Need a custom GraphQL resolver or a permission plugin — out of scope for this doc, but called out so we don't forget.








# XO Pure — Twenty CRM Object Specification

> **Version:** 1.0
> **CRM URL:** `crm.xopure.com`
> **Source DB:** Supabase (production)
> **Sync cadence:** Daily ETL pull from Supabase → Twenty
> **Pattern:** Supabase is source of truth for money; Twenty is the relationship layer

---

## Architecture Principles

1. **Every synced object has a `supabaseId` UUID field.** This is the sync key. ETL uses it for upsert.
2. **Money-touching fields are read-only in Twenty.** Enforced by (a) ETL service-account-only write permission and (b) UI tooltips that say "synced from commission engine."
3. **Relationship/operational fields are bidirectional.** Notes, tasks, tags, onboarding stage, communication preferences, internal notes — these write to Twenty and are not synced back to Supabase except via explicit user actions.
4. **Visibility is graduated.** Custom resolvers check `viewing_user.ambassador_id` against the requested record. L1 downline = full visibility, L2-L3 = redacted PII, L4+ = aggregates only.
5. **Leverage Twenty standard objects where they fit.** Use built-in Task and Note. Override Person/Company. Skip Opportunity (rank-driven pipeline, not deal-driven).

---

## Object Index

| # | Object | Source | Sync |
|---|---|---|---|
| 1 | Ambassador | Supabase `affiliates` | Read mostly |
| 2 | Customer | Supabase `customers` | Read mostly |
| 3 | Order | Supabase `orders` | Read-only |
| 4 | Commission Line | Supabase `commission_ledger` | Read-only |
| 5 | Payment | Supabase `payments` | Read-only |
| 6 | Payout Batch | Supabase `payout_ledger` | Read-only |
| 7 | Shipment | Supabase `shipments` | Read-only |
| 8 | Product | Supabase `products` | Read-only |
| 9 | Period | Supabase `commission_periods` | Read-only |
| 10 | Rank Definition | Supabase `rank_definitions` | Read-only |
| 11 | Commission Config Version | Supabase `commission_config_versions` | Read-only |
| 12 | Audit Log | Twenty | Twenty-native |
| 13 | Webhook Event | Supabase `webhook_events` | Read-only |
| 14 | Communication Log | Twenty + Resend/Twilio | Mixed |
| 15 | Approval Request | Twenty | Twenty-native |
| 16 | Reconciliation Exception | Supabase + Twenty | Mixed |
| 17 | Clinic Account | Twenty (B2B pipeline) | Twenty-native |

---

## 1. Ambassador

`nameSingular: ambassador` · `icon: IconUserCheck`

Core registry of every ambassador. Identity, sponsor chain, status, current-period rollups.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| ambassadorCode | TEXT | No | Supabase |
| fullName | FULL_NAME | No | Supabase |
| emails | EMAILS | No | Supabase |
| phones | PHONES | No | Supabase |
| path | SELECT (`standard`/`elite`/`referral`) | No | Supabase |
| sponsor | RELATION → Ambassador | No | Supabase |
| enrolledAt | DATE_TIME | No | Supabase |
| qualifiedRank | SELECT (`L0-Customer`...`L6-Icon`) | No | Supabase |
| eliteMaintained | BOOLEAN | No | Supabase |
| customerCV | CURRENCY | No | Supabase |
| groupCV | CURRENCY | No | Supabase |
| personalOrderCV | CURRENCY | No | Supabase |
| activeCustomerCount | NUMBER | No | Supabase |
| personalEnrollments | NUMBER | No | Supabase |
| currentTier | SELECT (`tier1`-`tier4`) | No | Computed |
| lifetimeEarnings | CURRENCY | No | Supabase |
| onboardingStage | SELECT (`invited`/`enrolled`/`trained`/`active`/`coach_needed`/`dormant`) | **Yes** | Twenty |
| relationshipOwner | RELATION → User | **Yes** | Twenty |
| tags | MULTI_SELECT | **Yes** | Twenty |
| internalNotes | RICH_TEXT | **Yes** | Twenty |
| communicationPreferences | MULTI_SELECT (`email`/`sms`/`call`/`do_not_contact`) | **Yes** | Twenty |
| complianceHoldReason | TEXT | **Yes** | Twenty (admin only) |

**Relations**
- Has many: Customers (as referrer), Orders, CommissionLines, PayoutBatches, Tasks, Notes
- Belongs to: Sponsor (self-ref), Period (current)

**Behaviors**
- Visibility scoped: reps see own row + L1 downline in full; L2-L3 PII-redacted; L4+ aggregates only.
- `qualifiedRank` change triggers Slack alert.

---

## 2. Customer

`nameSingular: customer` · `icon: IconUserCircle`

End customers. Distinct from Ambassador. PII access-controlled by referring relationship.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| customerCode | TEXT | No | Supabase |
| fullName | FULL_NAME | No | Supabase |
| emails | EMAILS | No | Supabase |
| phones | PHONES | No | Supabase |
| shippingAddress | ADDRESS | No | Supabase |
| referrer | RELATION → Ambassador | No | Supabase |
| enrolledAt | DATE_TIME | No | Supabase |
| isActive | BOOLEAN | No | Supabase |
| lifetimeCV | CURRENCY | No | Supabase |
| lifetimeSpend | CURRENCY | No | Supabase |
| lastOrderAt | DATE_TIME | No | Supabase |
| orderCount | NUMBER | No | Supabase |
| subscriptionStatus | SELECT (`none`/`active`/`paused`/`cancelled`) | No | Supabase |
| customerNotes | RICH_TEXT | **Yes** | Twenty (direct ambassador only) |
| tags | MULTI_SELECT | **Yes** | Twenty |
| communicationPreferences | MULTI_SELECT | **Yes** | Twenty |
| acquisitionSource | SELECT (`direct_link`/`social_post`/`event`/`referral`/`other`) | **Yes** | Twenty |

**Relations**
- Belongs to: Referrer (Ambassador)
- Has many: Orders, Shipments, Notes, Tasks

**Behaviors**
- Field-level visibility: if `viewing_user.ambassador_id ≠ customer.referrer_id`, emails/phones/address return masked values. Custom resolver required.

---

## 3. Order

`nameSingular: order` · `icon: IconShoppingCart`

Every transaction. Links Customer → Ambassador → Commission Lines.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| orderCode | TEXT | No | Supabase |
| customer | RELATION → Customer | No | Supabase |
| referringAmbassador | RELATION → Ambassador | No | Supabase |
| product | RELATION → Product | No | Supabase |
| orderedAt | DATE_TIME | No | Supabase |
| settledAt | DATE_TIME | No | Supabase |
| status | SELECT (`pending`/`paid`/`shipped`/`delivered`/`refunded`/`chargeback`) | No | Supabase |
| quantity | NUMBER | No | Supabase |
| unitPrice | CURRENCY | No | Supabase |
| totalRetail | CURRENCY | No | Supabase |
| totalCV | CURRENCY | No | Supabase |
| period | RELATION → Period | No | Supabase |
| paymentMethod | SELECT (`stripe`/`paypal`) | No | Supabase |
| stripePaymentIntentId | TEXT | No | Supabase |
| paypalCaptureId | TEXT | No | Supabase |
| isPersonalOrder | BOOLEAN | No | Supabase |
| fraudScore | NUMBER | No | Supabase |
| fraudFlagged | BOOLEAN | No | Supabase |
| discountCode | TEXT | No | Supabase |

**Relations**
- Belongs to: Customer, Referring Ambassador, Product, Period
- Has many: CommissionLines, Shipments, Payments

**Behaviors**
- One order generates 1-8 commission lines (L1-L4 + up to 4 gens).
- Refund triggers reversal lines (negative amounts).

---

## 4. Commission Line

`nameSingular: commissionLine` · `icon: IconCoin`

Granular audit trail: one ambassador, one order, one level, one amount.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| order | RELATION → Order | No | Supabase |
| earningAmbassador | RELATION → Ambassador | No | Supabase |
| period | RELATION → Period | No | Supabase |
| commissionType | SELECT (`tiered_l1`/`l2`/`l3`/`l4`/`gen_1`-`gen_4`/`milestone_bronze`/`milestone_silver`/`milestone_gold`/`fast_start`) | No | Supabase |
| commissionLevel | NUMBER (1-8) | No | Supabase |
| baseCV | CURRENCY | No | Supabase |
| rate | NUMERIC | No | Supabase |
| tierBracket | SELECT (`t1`/`t2`/`t3`/`t4`) | No | Supabase |
| amount | CURRENCY | No | Supabase |
| status | SELECT (`held`/`payable`/`paid`/`reversed`) | No | Supabase |
| heldUntil | DATE_TIME | No | Supabase |
| compressionApplied | BOOLEAN | No | Supabase |
| skippedAncestors | RAW_JSON | No | Supabase |
| payoutBatch | RELATION → PayoutBatch | No | Supabase |
| commissionConfigVersion | RELATION → CommissionConfigVersion | No | Supabase |

**Relations**
- Belongs to: Order, Earning Ambassador, Period, Payout Batch, Commission Config Version

**Behaviors**
- Powers the explainability drawer: "why did I earn $182?"
- `compressionApplied` + `skippedAncestors` makes dynamic compression auditable.

---

## 5. Payment

`nameSingular: payment` · `icon: IconCreditCard`

Inbound payment events from Stripe/PayPal.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| order | RELATION → Order | No | Supabase |
| paymentMethod | SELECT (`stripe`/`paypal`) | No | Supabase |
| externalId | TEXT | No | Supabase |
| amount | CURRENCY | No | Supabase |
| status | SELECT (`pending`/`succeeded`/`failed`/`refunded`/`disputed`) | No | Supabase |
| processedAt | DATE_TIME | No | Supabase |
| failureReason | TEXT | No | Supabase |
| refundAmount | CURRENCY | No | Supabase |
| webhookEvent | RELATION → WebhookEvent | No | Supabase |

**Relations**
- Belongs to: Order
- Belongs to: Webhook Event (originating event)

---

## 6. Payout Batch

`nameSingular: payoutBatch` · `icon: IconBuildingBank`

Outbound batch of commission payments to ambassadors.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| batchCode | TEXT | No | Supabase |
| ambassador | RELATION → Ambassador | No | Supabase |
| period | RELATION → Period | No | Supabase |
| totalAmount | CURRENCY | No | Supabase |
| lineCount | NUMBER | No | Supabase |
| status | SELECT (`queued`/`processing`/`paid`/`failed`/`held`) | No | Supabase |
| payoutMethod | SELECT (`ach`/`paypal`/`check`/`pending_info`) | No | Supabase |
| externalPayoutId | TEXT | No | Supabase |
| scheduledFor | DATE_TIME | No | Supabase |
| paidAt | DATE_TIME | No | Supabase |
| holdReason | TEXT | No | Supabase |
| holdResolvedBy | RELATION → User | **Yes** | Twenty |
| holdResolvedAt | DATE_TIME | **Yes** | Twenty |
| internalNotes | RICH_TEXT | **Yes** | Twenty |

**Relations**
- Belongs to: Ambassador, Period
- Has many: CommissionLines

**Behaviors**
- Hold resolution requires admin role + reason in `internalNotes`.
- Status change to `paid` triggers email to ambassador.

---

## 7. Shipment

`nameSingular: shipment` · `icon: IconTruck`

Fulfillment and tracking. Pulled from fulfillment provider, synced via Supabase.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| order | RELATION → Order | No | Supabase |
| customer | RELATION → Customer | No | Supabase |
| status | SELECT (`pending`/`label_created`/`in_transit`/`out_for_delivery`/`delivered`/`exception`/`returned`) | No | Supabase |
| carrier | SELECT (`usps`/`ups`/`fedex`/`dhl`) | No | Supabase |
| trackingNumber | TEXT | No | Supabase |
| trackingUrl | LINKS | No | Supabase |
| shippedAt | DATE_TIME | No | Supabase |
| deliveredAt | DATE_TIME | No | Supabase |
| exceptionReason | TEXT | No | Supabase |
| supportTicketId | RELATION → Task | **Yes** | Twenty |

**Relations**
- Belongs to: Order, Customer
- Belongs to: Support Task (when exception triggers ticket)

---

## 8. Product

`nameSingular: product` · `icon: IconPackage`

Product catalog. Each row = one SKU.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| sku | TEXT | No | Supabase |
| name | TEXT | No | Supabase |
| category | SELECT (`nad`/`metalean`/`bpc_tb500`/`klow`) | No | Supabase |
| format | SELECT (`oral_strip`/`other`) | No | Supabase |
| retailPrice | CURRENCY | No | Supabase |
| cvAmount | CURRENCY | No | Supabase |
| stripePriceId | TEXT | No | Supabase |
| safeDescription | RICH_TEXT | No | Supabase |
| restrictedClaims | MULTI_SELECT | No | Supabase |
| isActive | BOOLEAN | No | Supabase |
| commissionEligible | BOOLEAN | No | Supabase |
| marketingNotes | RICH_TEXT | **Yes** | Twenty |
| tags | MULTI_SELECT | **Yes** | Twenty |

**Relations**
- Has many: Orders

---

## 9. Period

`nameSingular: period` · `icon: IconCalendar`

Monthly commission period. Most queries scope by period.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| periodCode | TEXT | No | Supabase (e.g. "2026-04") |
| startDate | DATE | No | Supabase |
| endDate | DATE | No | Supabase |
| status | SELECT (`open`/`locked`/`finalized`/`paid`) | No | Supabase |
| commissionConfigVersion | RELATION → CommissionConfigVersion | No | Supabase |
| totalRetail | CURRENCY | No | Supabase |
| totalCV | CURRENCY | No | Supabase |
| totalPayouts | CURRENCY | No | Supabase |
| payoutPercentOfRetail | NUMERIC | No | Supabase |
| frozenAt | DATE_TIME | No | Supabase |
| finalizedBy | RELATION → User | No | Supabase |
| internalNotes | RICH_TEXT | **Yes** | Twenty |

**Relations**
- Has many: Orders, CommissionLines, PayoutBatches, PeriodSnapshots

---

## 10. Rank Definition

`nameSingular: rankDefinition` · `icon: IconStairs`

Versioned rank thresholds. Admin-only edits trigger new versions.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| rankCode | TEXT | No | Supabase |
| rankName | TEXT | No | Supabase |
| rankOrder | NUMBER | No | Supabase |
| minActiveCustomers | NUMBER | No | Supabase |
| minGroupCV | CURRENCY | No | Supabase |
| minPersonalOrderCV | CURRENCY | No | Supabase |
| unlocksGenerations | NUMBER (0-4) | No | Supabase |
| effectiveFrom | DATE | No | Supabase |
| effectiveTo | DATE | No | Supabase |
| isActive | BOOLEAN | No | Supabase |

---

## 11. Commission Config Version

`nameSingular: commissionConfigVersion` · `icon: IconAdjustments`

Versioned rate cards. Each period uses one version. Changes propagate forward, not retroactively.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| versionCode | TEXT | No | Supabase (e.g. "v1.3") |
| effectiveFrom | DATE | No | Supabase |
| effectiveTo | DATE | No | Supabase |
| tier1Rate | NUMERIC | No | Supabase (0.30) |
| tier2Rate | NUMERIC | No | Supabase (0.35) |
| tier3Rate | NUMERIC | No | Supabase (0.40) |
| tier4Rate | NUMERIC | No | Supabase (0.45) |
| tier1Ceiling | CURRENCY | No | Supabase (5000) |
| tier2Ceiling | CURRENCY | No | Supabase (10000) |
| tier3Ceiling | CURRENCY | No | Supabase (25000) |
| standardL2Rate | NUMERIC | No | Supabase |
| standardL3Rate | NUMERIC | No | Supabase |
| standardL4Rate | NUMERIC | No | Supabase |
| eliteL2Rate | NUMERIC | No | Supabase |
| eliteL3Rate | NUMERIC | No | Supabase |
| eliteL4Rate | NUMERIC | No | Supabase |
| generationRate | NUMERIC | No | Supabase (0.04) |
| fastStartPoolPercent | NUMERIC | No | Supabase (0.02) |
| bronzeThreshold | CURRENCY | No | Supabase |
| bronzeBonus | CURRENCY | No | Supabase |
| silverThreshold | CURRENCY | No | Supabase |
| silverBonus | CURRENCY | No | Supabase |
| goldThreshold | CURRENCY | No | Supabase |
| goldBonus | CURRENCY | No | Supabase |
| changeNotes | RICH_TEXT | No | Supabase |

**Relations**
- Has many: Periods, CommissionLines

---

## 12. Audit Log

`nameSingular: auditLog` · `icon: IconHistory`

Every edit on every record. Twenty-native.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| occurredAt | DATE_TIME | No | Twenty |
| actor | ACTOR | No | Twenty |
| objectType | TEXT | No | Twenty |
| objectId | UUID | No | Twenty |
| action | SELECT (`create`/`update`/`delete`/`restore`) | No | Twenty |
| fieldChanges | RAW_JSON | No | Twenty |
| reason | TEXT | No | Twenty |
| approvalRequest | RELATION → ApprovalRequest | No | Twenty |

**Behaviors**
- Auto-populated by Twenty triggers on all editable fields.
- Sponsor reassignment, rank override, and manual payout actions require `reason` field.
- Approval-required actions link back to their ApprovalRequest.

---

## 13. Webhook Event

`nameSingular: webhookEvent` · `icon: IconWebhook`

Raw webhook payloads from external services.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| source | SELECT (`stripe`/`paypal`/`fulfillment`/`resend`/`twilio`) | No | Supabase |
| eventType | TEXT | No | Supabase |
| externalEventId | TEXT | No | Supabase |
| receivedAt | DATE_TIME | No | Supabase |
| processedAt | DATE_TIME | No | Supabase |
| status | SELECT (`received`/`processed`/`failed`/`replayed`) | No | Supabase |
| payload | RAW_JSON | No | Supabase |
| relatedOrder | RELATION → Order | No | Supabase |
| relatedPayment | RELATION → Payment | No | Supabase |
| failureReason | TEXT | No | Supabase |

---

## 14. Communication Log

`nameSingular: communicationLog` · `icon: IconMessageCircle`

Email/SMS/call activity. Auto-populated from Resend, Twilio, and manual logging.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| occurredAt | DATE_TIME | No | Resend/Twilio/manual |
| channel | SELECT (`email`/`sms`/`call`/`meeting`/`other`) | Yes | Mixed |
| direction | SELECT (`outbound`/`inbound`) | Yes | Mixed |
| recipient | RELATION → Ambassador OR Customer | Yes | Mixed |
| ambassador | RELATION → Ambassador (sender, if XO team) | Yes | Twenty |
| subject | TEXT | Yes | Mixed |
| body | RICH_TEXT | Yes | Mixed |
| externalMessageId | TEXT | No | Resend/Twilio |
| status | SELECT (`sent`/`delivered`/`opened`/`clicked`/`bounced`/`failed`) | No | Resend/Twilio |
| templateUsed | TEXT | No | Resend |

**Behaviors**
- Inbound replies create new logs and link back to outbound original.
- Drip campaign sends auto-populate this object.

---

## 15. Approval Request

`nameSingular: approvalRequest` · `icon: IconChecks`

Queue for actions requiring admin sign-off (sponsor reassignment, rank override, manual payout).

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| requestedAt | DATE_TIME | No | Twenty |
| requestedBy | ACTOR | No | Twenty |
| actionType | SELECT (`sponsor_reassign`/`rank_override`/`manual_payout`/`compliance_hold`/`refund`/`commission_adjustment`) | No | Twenty |
| targetObjectType | TEXT | No | Twenty |
| targetObjectId | UUID | No | Twenty |
| proposedChange | RAW_JSON | No | Twenty |
| reason | RICH_TEXT | **Yes** | Twenty |
| status | SELECT (`pending`/`approved`/`rejected`/`cancelled`) | **Yes** (admin) | Twenty |
| reviewedBy | RELATION → User | **Yes** (admin) | Twenty |
| reviewedAt | DATE_TIME | **Yes** (admin) | Twenty |
| reviewNotes | RICH_TEXT | **Yes** (admin) | Twenty |
| slackThreadUrl | LINKS | No | Auto |

**Behaviors**
- Creation triggers Slack alert in `#ops-approvals`.
- Approval execution writes to Supabase via service-account API call.
- Rejection sends notification to requester.

---

## 16. Reconciliation Exception

`nameSingular: reconciliationException` · `icon: IconAlertTriangle`

Issues requiring review: Stripe ↔ Supabase mismatches, Twenty sync conflicts, fraud flags.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| supabaseId | UUID | No | Supabase |
| detectedAt | DATE_TIME | No | Supabase |
| exceptionType | SELECT (`payment_mismatch`/`sync_conflict`/`fraud_flag`/`commission_anomaly`/`payout_failure`/`shipping_exception`) | No | Supabase |
| severity | SELECT (`info`/`warning`/`critical`) | No | Supabase |
| description | TEXT | No | Supabase |
| relatedOrder | RELATION → Order | No | Supabase |
| relatedAmbassador | RELATION → Ambassador | No | Supabase |
| relatedPayment | RELATION → Payment | No | Supabase |
| status | SELECT (`open`/`investigating`/`resolved`/`wont_fix`) | **Yes** | Twenty |
| assignee | RELATION → User | **Yes** | Twenty |
| resolutionNotes | RICH_TEXT | **Yes** | Twenty |
| resolvedAt | DATE_TIME | **Yes** | Twenty |
| approvalRequest | RELATION → ApprovalRequest | **Yes** | Twenty |

**Behaviors**
- `critical` severity auto-creates a Task assigned to ops lead.
- Resolution requires assignee + notes.

---

## 17. Clinic Account

`nameSingular: clinicAccount` · `icon: IconBuildingHospital`

B2B prospects: clinics, med spas, chiropractors, practitioners. Separate from Customer because they have a different sales cycle and wholesale pricing.

**Fields**

| Field | Type | Editable | Source |
|---|---|---|---|
| businessName | TEXT | Yes | Twenty |
| businessType | SELECT (`med_spa`/`chiropractor`/`wellness_clinic`/`functional_med`/`anti_aging`/`other`) | Yes | Twenty |
| primaryContact | FULL_NAME | Yes | Twenty |
| emails | EMAILS | Yes | Twenty |
| phones | PHONES | Yes | Twenty |
| address | ADDRESS | Yes | Twenty |
| website | LINKS | Yes | Twenty |
| socialHandles | LINKS | Yes | Twenty |
| pipelineStage | SELECT (`new`/`contacted`/`packet_sent`/`call_booked`/`proposal_sent`/`onboarding`/`active`/`churned`) | Yes | Twenty |
| relationshipOwner | RELATION → User | Yes | Twenty |
| sourceAmbassador | RELATION → Ambassador | Yes | Twenty |
| estimatedMonthlyVolume | CURRENCY | Yes | Twenty |
| firstOrderAt | DATE_TIME | No | Supabase (when active) |
| lifetimeVolume | CURRENCY | No | Supabase |
| internalNotes | RICH_TEXT | Yes | Twenty |
| tags | MULTI_SELECT | Yes | Twenty |
| lastContactedAt | DATE_TIME | Yes | Twenty |
| nextFollowUpAt | DATE_TIME | Yes | Twenty |

**Behaviors**
- Once first order is placed, ClinicAccount links to a Customer record automatically.
- Pipeline stage changes auto-log in Communication Log.

---

## Implementation Sequence

The order I'd build these in Twenty:

**Phase 1 — Core read views (week 1-2)**
1. Ambassador
2. Customer
3. Order
4. Product
5. Period

**Phase 2 — Money objects (week 3)**
6. Commission Line
7. Payment
8. Payout Batch
9. Commission Config Version
10. Rank Definition

**Phase 3 — Operations layer (week 4)**
11. Shipment
12. Communication Log
13. Webhook Event

**Phase 4 — Governance (week 5)**
14. Audit Log
15. Approval Request
16. Reconciliation Exception

**Phase 5 — B2B pipeline (week 6+)**
17. Clinic Account

---

## ETL Sync Architecture

A single Vercel Cron job at 4am UTC daily runs:

```
1. Pull delta from Supabase (records updated since last sync timestamp)
2. For each Twenty object, upsert by supabaseId
3. Log any sync conflicts to Reconciliation Exception
4. Update last_sync_at watermark
5. Post summary to #ops-sync Slack channel
```

For near-real-time updates on critical events (paid order → commission line creation), Supabase database triggers post to a Twenty webhook endpoint that upserts immediately. Daily sync is the safety net.

**Conflict resolution rules:**
- Money fields: Supabase always wins
- Relationship fields (notes, tasks, tags): Twenty always wins
- Status fields with editable-in-Twenty markers: Twenty wins if updated_at > last_sync
- Everything else: most recent updated_at wins

---

## Permissions Model

Twenty's native permissions are workspace-level. We need three additional layers:

**Layer 1 — Role-based** (Twenty native)
- `admin`: full access to all objects and fields
- `ops`: read all, edit ops-tagged fields, approve queue items
- `support`: read all, edit support-tagged fields only
- `ambassador`: scoped by ambassador_id (see Layer 2)

**Layer 2 — Ambassador scope** (custom resolver)
- Every Ambassador role user has a linked `ambassador_id`
- Queries to Ambassador, Customer, Order, CommissionLine, PayoutBatch are filtered by visibility rules:
  - Own row: full access
  - L1 downline: full access
  - L2-L3 downline: PII-redacted
  - L4+ downline: aggregate-only views

**Layer 3 — Field-level redaction** (custom field resolver)
- Customer email/phone/address: returned masked unless `viewing_user.ambassador_id = customer.referrer_id` OR user has admin/ops role
- CommissionLine: visible only to earning ambassador or admin/ops
- ApprovalRequest: visible only to actors involved or admin

---

## Twenty UI Considerations

**Saved Views** to create out of the box:
- Ambassadors: "Elite at risk this month" (filter: path=elite AND eliteMaintained=false)
- Ambassadors: "Approaching next rank" (filter: within 10% of next rank thresholds)
- Orders: "Today's orders"
- Orders: "Fraud flagged"
- Commission Lines: "Pending release" (filter: status=held AND heldUntil < now)
- Payout Batches: "Held — needs review"
- Reconciliation Exceptions: "Critical and open"
- Approval Requests: "Pending review"
- Clinic Accounts: "Follow-up due this week"

**Custom field display rules**:
- All `supabaseId` fields hidden in default views (technical key only)
- Read-only fields display with subtle lock icon
- Currency fields render with USD symbol
- RAW_JSON fields collapsed by default with "show payload" toggle

---

## Open Questions

A few decisions worth confirming before build starts:

1. **Customer object vs. Twenty Person.** Recommendation: separate Customer object (we have too many domain-specific fields). Twenty's Person stays for non-customer contacts (partners, vendors, etc.).
2. **Ambassador authentication.** Recommendation: Twenty user accounts linked to Ambassador records via `auth_user_id`. SSO from XO Pure ambassador portal so they log in once.
3. **Field-level redaction implementation.** Twenty doesn't support this natively. Option A: build a GraphQL middleware that intercepts and masks. Option B: create separate "Customer Restricted View" objects that ETL populates with masked data. Recommendation: A is cleaner long-term.
4. **Daily sync vs. real-time.** Recommendation: real-time webhook sync for orders/payments/payouts; daily reconciliation sweep for everything else.