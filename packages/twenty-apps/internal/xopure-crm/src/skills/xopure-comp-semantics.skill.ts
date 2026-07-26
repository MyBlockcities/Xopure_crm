import { defineSkill } from 'twenty-sdk/define';

export default defineSkill({
  universalIdentifier: '5635361e-3916-4205-b46d-ea96a864d46b',
  name: 'xopure-comp-semantics',
  label: 'XO Pure Compensation Semantics',
  description: 'Interpret XO Pure revenue, volume, commission, payment, and refund data correctly.',
  icon: 'IconCurrencyDollar',
  content: `Use canonical XO Pure compensation semantics in every answer, dashboard, filter, and calculation.

Money and volume:
- Source-of-truth monetary values are integer cents fields. Prefer totalCents, amountCents, refundCents, personalVolumeCents, teamVolumeCents, attributedRevenueCents, heldCommissionCents, payableCommissionCents, paidCommissionCents, and lifetimeCommissionCents for arithmetic and reconciliation. Divide by 100 only for human display. Currency defaults to USD when the source omits it.
- CURRENCY twins such as orderTotal, amount, refundAmount, personalVolume, teamVolume, and commission balances are display/metadata fields. Never add a cents field to a CURRENCY field or divide a CURRENCY value by 100.
- CV is not cash. xopureOrder.cvAmount and commission.baseCvAmount are compensation volume; commission.rate is a percent. A source rate_used fraction is normalized to percent, while percentage_bps is divided by 100.

Canonical states:
- Orders: OPEN, PAID, FULFILLED, REFUNDED, CANCELLED. Revenue widgets count only PAID and FULFILLED. Do not count OPEN, CANCELLED, or REFUNDED as paid revenue. Order PARTIALLY_REFUNDED normalizes to REFUNDED, so use refundCents/refundAmount when netting partial refunds.
- Payments: PENDING, PROCESSING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED, CANCELLED. Gross settled payment volume uses SUCCEEDED. Refund totals use REFUNDED and PARTIALLY_REFUNDED plus refundCents. Never infer payment success from order.paymentStatus: it is normalized source text, not the canonical payment enum.
- Commissions: PENDING, APPROVED, HELD, PAID, VOID. APPROVED means payable approval, HELD is not payable yet, PAID is disbursed, and VOID must never contribute to payable or paid totals. Respect holdUntil, payableAt, and paidAt.
- Ambassadors: APPLIED, APPROVED, ACTIVE, PAUSED, REJECTED. Levels: SEED, BRONZE, SILVER, GOLD, PLATINUM, ELITE. Distinguish paidAsRank from careerRank.

Integrity rules:
- An order is commissionable only when cvAmount is greater than zero. Link commissions by orderExternalId/sourceOrderId and ambassadorExternalId before reconciling totals.
- Cancellation takes precedence when source fulfillment status is cancelled. The mapper can emit fulfillmentStatus CANCELLED although current object options omit it; surface this as a schema exception rather than silently coercing it.
- attributedRevenueCents is currently populated from source team_volume_cents. Label conclusions based on it as current mapped behavior, not independently sourced attributed revenue.
- Sync is idempotent by immutable external ID plus payload hash. FAILED_RETRYABLE, FAILED_PERMANENT, stale cursors, relation failures, or lastErrorSummary mean dashboard totals may be incomplete; call out sync health before asserting reconciliation is final.`,
});
