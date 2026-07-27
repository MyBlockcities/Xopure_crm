import { describe, expect, it } from 'vitest';

import {
  isLiveStatus,
  ledgerStatusLabel,
  normalizeLedgerStatus,
  summarizeLedger,
} from './display';

// The Twenty mirror (_xopureCommission.status) uses PENDING/HELD/APPROVED/VOID,
// which is NOT the Supabase commission_ledger vocabulary the guide documents.
// Both must land on the same canonical statuses.

describe('normalizeLedgerStatus', () => {
  it('maps the Twenty mirror vocabulary', () => {
    expect(normalizeLedgerStatus('PENDING')).toBe('held');
    expect(normalizeLedgerStatus('HELD')).toBe('held');
    expect(normalizeLedgerStatus('APPROVED')).toBe('payable');
    expect(normalizeLedgerStatus('VOID')).toBe('voided');
  });

  it('still maps the Supabase ledger vocabulary', () => {
    expect(normalizeLedgerStatus('payable')).toBe('payable');
    expect(normalizeLedgerStatus('accrued')).toBe('accrued');
    expect(normalizeLedgerStatus('reversed')).toBe('reversed');
    expect(normalizeLedgerStatus('paid')).toBe('paid');
  });

  it('is case and whitespace insensitive', () => {
    expect(normalizeLedgerStatus('  Approved ')).toBe('payable');
  });

  it('returns null for anything unrecognised rather than guessing', () => {
    expect(normalizeLedgerStatus('SOMETHING_NEW')).toBeNull();
    expect(normalizeLedgerStatus(null)).toBeNull();
  });

  it('does not promote PENDING to payable — that would overstate what is owed', () => {
    expect(normalizeLedgerStatus('PENDING')).not.toBe('payable');
  });
});

describe('ledgerStatusLabel with mirror statuses', () => {
  it('gives the fixed §2.4 wording', () => {
    expect(ledgerStatusLabel('APPROVED')).toBe('Payable — next Friday');
    expect(ledgerStatusLabel('PENDING')).toBe('Clearing (7-day hold)');
    expect(ledgerStatusLabel('VOID')).toBe('Voided');
  });

  it('surfaces an unknown status instead of hiding it (§2.6)', () => {
    expect(ledgerStatusLabel('WAT')).toContain('⚠');
  });
});

describe('isLiveStatus', () => {
  it('counts mirror statuses that represent real money', () => {
    expect(isLiveStatus('APPROVED')).toBe(true);
    expect(isLiveStatus('PENDING')).toBe(true);
  });

  it('excludes voided money', () => {
    expect(isLiveStatus('VOID')).toBe(false);
  });
});

describe('summarizeLedger with live mirror rows', () => {
  // Shaped like the real _xopureCommission rows on the live workspace.
  const rows = [
    { pay_area: 'CUSTOMER_SALES', status: 'APPROVED', amount_cents: 5_000 },
    { pay_area: 'TEAM_L1', status: 'APPROVED', amount_cents: 2_000 },
    { pay_area: 'TEAM_L2', status: 'PENDING', amount_cents: 1_000 },
    { pay_area: 'GENERATION_G1', status: 'APPROVED', amount_cents: 900 },
    { pay_area: 'GENERATION_G2', status: 'PENDING', amount_cents: 400 },
    { pay_area: 'FAST_START_POOL', status: 'APPROVED', amount_cents: 300 },
    { pay_area: null, status: 'HELD', amount_cents: 100 },
    { pay_area: 'CUSTOMER_SALES', status: 'VOID', amount_cents: 700 },
  ];

  const totals = summarizeLedger(rows);

  it('keeps generation off the weekly rail even when marked APPROVED', () => {
    // 900 + 400 are both generation, so neither may reach weeklyPayable.
    expect(totals.accruedGenerationCents).toBe(1_300);
    expect(totals.weeklyPayableCents).toBe(5_000 + 2_000 + 300);
  });

  it('puts PENDING team money on the weekly held rail', () => {
    expect(totals.weeklyHeldCents).toBe(1_000 + 100);
  });

  it('keeps voided money out of every live total', () => {
    expect(totals.reversedCents).toBe(700);
  });

  it('surfaces the pay areas it cannot map (§2.6)', () => {
    // FAST_START_POOL and the null pay area both exist on the live workspace
    // and are not in the guide — they must be reported, not dropped.
    expect(totals.unmappedRows).toHaveLength(2);
  });
});
