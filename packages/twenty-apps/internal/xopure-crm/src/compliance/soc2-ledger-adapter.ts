import type { MappedSourceRecord } from '../supabase-sync/types/mapped-source-record.type';

const DEFAULT_RECORDED_AT = (): string => new Date().toISOString();

const PAY_AREAS: Record<string, true> = {
  CUSTOMER_SALES: true,
  TEAM_L1: true,
  TEAM_L2: true,
  WHOLESALE: true,
  BONUS: true,
  ADJUSTMENT: true,
};

const normalizeString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const normalizeInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : undefined;

const normalizeStatus = (value: unknown): string => {
  const normalized = normalizeString(value)?.toUpperCase();

  switch (normalized) {
    case 'HELD':
    case 'HOLD':
      return 'held';
    case 'PAYABLE':
      return 'payable';
    case 'APPROVED':
      return 'approved';
    case 'SETTLED':
      return 'settled';
    case 'PAID':
      return 'paid';
    case 'VOID':
    case 'VOIDED':
    case 'CANCELLED':
    case 'CANCELED':
    case 'FAILED':
      return 'void';
    case 'REFUNDED':
    case 'REVERSED':
      return 'reversed';
    case 'REISSUED':
      return 'reissued';
    case 'PENDING':
    default:
      return 'pending';
  }
};

const normalizePayArea = (value: unknown): string => {
  const normalized = normalizeString(value)?.toUpperCase();

  return normalized && PAY_AREAS[normalized] ? normalized : 'CUSTOMER_SALES';
};

const rateToBasisPoints = (value: unknown): number => {
  const rate = normalizeInteger(value);

  return rate === undefined ? 0 : Math.round(rate * 100);
};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return undefined;
};

export const mapToLedgerEntry = (
  mappedRecord: MappedSourceRecord,
  recordedAt: () => string = DEFAULT_RECORDED_AT,
): Record<string, unknown> => {
  const fields = mappedRecord.fieldValues;
  const isPayment = mappedRecord.sourceTable === 'payments';

  return {
    schema_version: '1.0',
    ledger_id:
      firstString(
        fields.supabaseCommissionId,
        fields.supabasePaymentId,
        mappedRecord.externalIdValue,
        mappedRecord.sourceRecordId,
      ) ?? mappedRecord.syncKey,
    status: normalizeStatus(fields.status),
    pay_area: normalizePayArea(fields.payArea),
    amount_cents: normalizeInteger(fields.amountCents) ?? 0,
    basis_cents:
      normalizeInteger(fields.baseCvAmount) ?? normalizeInteger(fields.amountCents) ?? 0,
    rate_bps: rateToBasisPoints(fields.rate),
    recipient_id:
      firstString(fields.ambassadorExternalId, fields.recipientId) ??
      'unknown-recipient',
    buyer_id: firstString(fields.buyerId, fields.orderExternalId) ?? 'unknown-buyer',
    classification: isPayment ? 'payment' : 'commission',
    order_id:
      firstString(fields.orderExternalId, fields.sourceOrderId) ?? 'unknown-order',
    recorded_at:
      firstString(fields.paidAt, fields.payableAt, fields.lastSyncedAt) ?? recordedAt(),
    retention_class: 'standard',
    redaction_class: 'internal',
  };
};
