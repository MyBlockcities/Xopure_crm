import { describe, expect, it } from 'vitest';

import { mapToLedgerEntry } from './soc2-ledger-adapter';
import type { MappedSourceRecord } from '../supabase-sync/types/mapped-source-record.type';

const baseMappedRecord = (
  overrides: Partial<MappedSourceRecord> = {},
): MappedSourceRecord => ({
  sourceSystem: 'supabase',
  sourceSchema: 'public',
  sourceTable: 'commission_ledger',
  sourceRecordId: 'commission-1',
  syncKey: 'supabase.public.commission_ledger.commission-1',
  targetObject: 'xopureCommission',
  externalIdField: 'supabaseCommissionId',
  externalIdValue: 'commission-1',
  fieldValues: {
    supabaseCommissionId: 'commission-1',
    ambassadorExternalId: 'ambassador-1',
    orderExternalId: 'order-1',
    amountCents: 2215,
    baseCvAmount: 7000,
    rate: 20,
    status: 'HELD',
    payArea: 'TEAM_L1',
    paidAt: '2026-07-04T12:00:00.000Z',
  },
  relations: [],
  contentHash: 'content-hash',
  ...overrides,
});

describe('mapToLedgerEntry', () => {
  it('maps commission records into the SOC2 ledger_entry contract', () => {
    const result = mapToLedgerEntry(baseMappedRecord());

    expect(result).toMatchObject({
      schema_version: '1.0',
      ledger_id: 'commission-1',
      status: 'held',
      pay_area: 'TEAM_L1',
      amount_cents: 2215,
      basis_cents: 7000,
      rate_bps: 2000,
      recipient_id: 'ambassador-1',
      buyer_id: 'order-1',
      classification: 'commission',
      order_id: 'order-1',
      recorded_at: '2026-07-04T12:00:00.000Z',
      retention_class: 'standard',
      redaction_class: 'internal',
    });
  });

  it('maps payment records into the SOC2 ledger_entry contract', () => {
    const result = mapToLedgerEntry(
      baseMappedRecord({
        sourceTable: 'payments',
        sourceRecordId: 'payment-1',
        syncKey: 'supabase.public.payments.payment-1',
        targetObject: 'xopurePayment',
        externalIdField: 'supabasePaymentId',
        externalIdValue: 'payment-1',
        fieldValues: {
          supabasePaymentId: 'payment-1',
          orderExternalId: 'order-1',
          amountCents: 11075,
          status: 'PAID',
          lastSyncedAt: '2026-07-04T12:01:00.000Z',
        },
      }),
    );

    expect(result).toMatchObject({
      ledger_id: 'payment-1',
      status: 'paid',
      pay_area: 'CUSTOMER_SALES',
      amount_cents: 11075,
      basis_cents: 11075,
      rate_bps: 0,
      recipient_id: 'unknown-recipient',
      buyer_id: 'order-1',
      classification: 'payment',
      order_id: 'order-1',
      recorded_at: '2026-07-04T12:01:00.000Z',
    });
  });

  it.each([
    ['HELD', 'held'],
    ['PAID', 'paid'],
    ['VOID', 'void'],
    ['REFUNDED', 'reversed'],
    ['unexpected', 'pending'],
  ])('normalizes status %s to %s', (inputStatus, expectedStatus) => {
    const result = mapToLedgerEntry(
      baseMappedRecord({
        fieldValues: {
          ...baseMappedRecord().fieldValues,
          status: inputStatus,
        },
      }),
    );

    expect(result.status).toBe(expectedStatus);
  });

  it('falls back to safe ledger defaults when optional fields are missing', () => {
    const result = mapToLedgerEntry(
      baseMappedRecord({
        fieldValues: {
          supabaseCommissionId: 'commission-2',
          amountCents: 500,
          status: 'PENDING',
        },
      }),
      () => '2026-07-04T12:02:00.000Z',
    );

    expect(result).toMatchObject({
      ledger_id: 'commission-2',
      pay_area: 'CUSTOMER_SALES',
      amount_cents: 500,
      basis_cents: 500,
      rate_bps: 0,
      recipient_id: 'unknown-recipient',
      buyer_id: 'unknown-buyer',
      order_id: 'unknown-order',
      recorded_at: '2026-07-04T12:02:00.000Z',
    });
  });
});
