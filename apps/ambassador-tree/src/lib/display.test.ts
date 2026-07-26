import { describe, expect, it } from 'vitest';

import {
  bpsToPercent,
  compWeekBounds,
  cvFromRetailCents,
  describeLedgerRate,
  formatCapAdjustment,
  formatCents,
  formatCompWeek,
  formatRate,
  formatRetailAndCv,
  LEDGER_STATUS_LABELS,
  ledgerStatusLabel,
  maskAccountNumber,
  maskPayoutDetails,
  nextGenerationPayoutDate,
  PAY_AREAS,
  payArea,
  payAreaOrUnmapped,
  payoutCapCents,
  summarizeLedger,
  UnmappedPayAreaError,
} from './display';

// ─── §8 money ───────────────────────────────────────────────────────────────

describe('money (§8: integer cents, divide by 100 only at render)', () => {
  it('formats cents as currency', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(1)).toBe('$0.01');
    expect(formatCents(12_345)).toBe('$123.45');
    expect(formatCents(100_000)).toBe('$1,000.00');
  });

  it('treats null/undefined as zero rather than NaN', () => {
    expect(formatCents(null)).toBe('$0.00');
    expect(formatCents(undefined)).toBe('$0.00');
  });

  it('derives CV as 50% of retail', () => {
    expect(cvFromRetailCents(10_000)).toBe(5_000);
    expect(cvFromRetailCents(999)).toBe(500);
  });

  it('shows both bases together (§2.3)', () => {
    expect(formatRetailAndCv(12_000)).toBe('$120.00 retail · $60.00 CV');
    // Prefers the ledger's CV over a derived one.
    expect(formatRetailAndCv(12_000, 5_000)).toBe('$120.00 retail · $50.00 CV');
  });
});

// ─── §2.2 basis ─────────────────────────────────────────────────────────────

describe('§2.2 — every rate states its basis', () => {
  it('renders Way 01 against retail, not CV', () => {
    expect(formatRate(25, 'retail')).toBe('25% of retail');
    expect(formatRate(40, 'retail')).toBe('40% of retail');
  });

  it('renders rank-card team levels against CV', () => {
    expect(formatRate(30, 'CV')).toBe('30% of CV');
  });

  it('trims trailing zeros but keeps real decimals', () => {
    expect(formatRate(1.25, 'retail')).toBe('1.25% of retail');
    expect(formatRate(5.0, 'CV')).toBe('5% of CV');
  });

  it('converts basis points', () => {
    expect(bpsToPercent(2500)).toBe(25);
    expect(bpsToPercent(125)).toBe(1.25);
  });
});

// ─── §1.4 pay areas ─────────────────────────────────────────────────────────

describe('pay area registry', () => {
  it('covers every pay area named in the guide', () => {
    const expected = [
      'CUSTOMER_SALES',
      'TEAM_POOL_S1',
      'TEAM_POOL_S2',
      'TEAM_POOL_S3',
      'TEAM_POOL_S4',
      'GENERATION_G1',
      'GENERATION_G2',
      'GENERATION_G3',
      'GENERATION_G4',
      'TEAM_L1',
      'TEAM_L2',
      'TEAM_L3',
      'TEAM_L4',
      'WHOLESALE_DIRECT',
      'WHOLESALE_TEAM_S1',
      'WHOLESALE_GEN_S1',
      'GEN_POOL_S1',
    ];

    for (const code of expected) {
      expect(PAY_AREAS[code], `missing pay area ${code}`).toBeDefined();
    }
  });

  it('puts Way 01 on retail and generation on CV', () => {
    expect(payArea('CUSTOMER_SALES').basis).toBe('retail');
    expect(payArea('GENERATION_G1').basis).toBe('CV');
    expect(payArea('TEAM_L2').basis).toBe('CV');
  });

  it('marks all generation as monthly and everything else weekly', () => {
    for (let g = 1; g <= 4; g += 1) {
      expect(payArea(`GENERATION_G${g}`).payCycle).toBe('monthly');
    }
    expect(payArea('CUSTOMER_SALES').payCycle).toBe('weekly');
    expect(payArea('TEAM_POOL_S1').payCycle).toBe('weekly');
    expect(payArea('WHOLESALE_DIRECT').payCycle).toBe('weekly');
  });

  it('flags the pre-2026-07-25 gen pool as legacy', () => {
    expect(payArea('GEN_POOL_S1').legacy).toBe(true);
    expect(payArea('GENERATION_G1').legacy).toBeUndefined();
  });

  it('throws on an unknown pay area', () => {
    expect(() => payArea('MYSTERY_BONUS')).toThrow(UnmappedPayAreaError);
  });
});

// ─── §2.6 never silently drop ───────────────────────────────────────────────

describe('§2.6 — unmappable pay areas are surfaced, never dropped', () => {
  it('returns a flagged placeholder instead of throwing', () => {
    const area = payAreaOrUnmapped('MYSTERY_BONUS');
    expect(area.unmapped).toBe(true);
    expect(area.label).toContain('Unmapped pay area');
    expect(area.label).toContain('MYSTERY_BONUS');
  });

  it('does not flag a known area', () => {
    expect(payAreaOrUnmapped('CUSTOMER_SALES').unmapped).toBe(false);
  });

  it('collects unmapped rows in the ledger summary', () => {
    const totals = summarizeLedger([
      { pay_area: 'CUSTOMER_SALES', status: 'payable', amount_cents: 100 },
      { pay_area: 'MYSTERY_BONUS', status: 'payable', amount_cents: 999 },
    ]);
    expect(totals.unmappedRows).toHaveLength(1);
  });
});

// ─── §2.2 rate labels ───────────────────────────────────────────────────────

describe('describeLedgerRate', () => {
  it('labels Way 01 with its retail basis', () => {
    expect(describeLedgerRate('CUSTOMER_SALES', 25)).toBe('25% of retail');
  });

  it('never renders a bare 1.25% for a pool seat', () => {
    const label = describeLedgerRate('TEAM_POOL_S2', 1.25);
    expect(label).toContain('5% Team Pool');
    expect(label).toContain('seat 2 of 4');
    expect(label).not.toBe('1.25% of retail');
  });

  it('labels generation with its CV basis and depth', () => {
    expect(describeLedgerRate('GENERATION_G2')).toBe('4% of CV · generation 2');
  });

  it('marks legacy gen pool rows', () => {
    expect(describeLedgerRate('GEN_POOL_S1')).toContain('legacy Gen Pool');
  });

  it('labels team levels with CV and level depth', () => {
    expect(describeLedgerRate('TEAM_L3', 15)).toBe('15% of CV · level 3');
  });

  it('surfaces an unmapped area rather than rendering a bare number', () => {
    expect(describeLedgerRate('MYSTERY_BONUS', 10)).toContain('Unmapped');
  });
});

// ─── §2.4 status wording ────────────────────────────────────────────────────

describe('§2.4 — fixed status wording', () => {
  it('uses the exact sanctioned strings', () => {
    expect(LEDGER_STATUS_LABELS.held).toBe('Clearing (7-day hold)');
    expect(LEDGER_STATUS_LABELS.payable).toBe('Payable — next Friday');
    expect(LEDGER_STATUS_LABELS.paid).toBe('Paid');
    expect(LEDGER_STATUS_LABELS.accrued).toBe('Generation — pays on the 5th');
  });

  it('is case insensitive', () => {
    expect(ledgerStatusLabel('PAYABLE')).toBe('Payable — next Friday');
  });

  it('surfaces an unknown status', () => {
    expect(ledgerStatusLabel('sideways')).toContain('Unknown status');
  });
});

// ─── §2.5 generation never joins the weekly rail ────────────────────────────

describe('§2.5 — generation is monthly and never in a weekly total', () => {
  it('keeps accrued generation out of weekly payable', () => {
    const totals = summarizeLedger([
      { pay_area: 'CUSTOMER_SALES', status: 'payable', amount_cents: 1_000 },
      { pay_area: 'GENERATION_G1', status: 'accrued', amount_cents: 5_000 },
    ]);

    expect(totals.weeklyPayableCents).toBe(1_000);
    expect(totals.accruedGenerationCents).toBe(5_000);
  });

  it('re-routes a generation row even if it is mis-statused as payable', () => {
    const totals = summarizeLedger([
      { pay_area: 'GENERATION_G2', status: 'payable', amount_cents: 4_000 },
    ]);

    expect(totals.weeklyPayableCents).toBe(0);
    expect(totals.accruedGenerationCents).toBe(4_000);
  });

  it('respects an explicit monthly pay_cycle', () => {
    const totals = summarizeLedger([
      {
        pay_area: 'CUSTOMER_SALES',
        status: 'payable',
        amount_cents: 700,
        pay_cycle: 'monthly',
      },
    ]);

    expect(totals.weeklyPayableCents).toBe(0);
    expect(totals.accruedGenerationCents).toBe(700);
  });

  it('separates held, paid and reversed', () => {
    const totals = summarizeLedger([
      { pay_area: 'CUSTOMER_SALES', status: 'held', amount_cents: 300 },
      { pay_area: 'CUSTOMER_SALES', status: 'paid', amount_cents: 900 },
      { pay_area: 'CUSTOMER_SALES', status: 'reversed', amount_cents: 200 },
      { pay_area: 'TEAM_POOL_S1', status: 'voided', amount_cents: 50 },
    ]);

    expect(totals.weeklyHeldCents).toBe(300);
    expect(totals.paidCents).toBe(900);
    expect(totals.reversedCents).toBe(250);
    expect(totals.weeklyPayableCents).toBe(0);
  });

  it('handles an empty ledger', () => {
    const totals = summarizeLedger([]);
    expect(totals.weeklyPayableCents).toBe(0);
    expect(totals.accruedGenerationCents).toBe(0);
  });
});

// ─── §8 comp week: Fri 00:00 → Thu 23:59 CST, UTC-6 fixed ───────────────────

describe('§8 — comp week is Fri 00:00 → Thu 23:59 CST (UTC-6 fixed)', () => {
  it('starts the week on Friday 00:00 CST', () => {
    // Wed 2026-07-15 12:00 UTC
    const { start, end } = compWeekBounds(new Date('2026-07-15T12:00:00Z'));

    // Friday 2026-07-10 00:00 CST == 06:00 UTC
    expect(start.toISOString()).toBe('2026-07-10T06:00:00.000Z');
    // Thursday 2026-07-16 23:59:59.999 CST == 2026-07-17T05:59:59.999Z
    expect(end.toISOString()).toBe('2026-07-17T05:59:59.999Z');
  });

  it('treats Friday 00:00 CST as the start of a new week, not the end', () => {
    const fridayMidnightCst = new Date('2026-07-10T06:00:00Z');
    const { start } = compWeekBounds(fridayMidnightCst);
    expect(start.toISOString()).toBe('2026-07-10T06:00:00.000Z');
  });

  it('keeps the last millisecond of Thursday inside the same week', () => {
    const lastMs = new Date('2026-07-17T05:59:59.999Z');
    const { start } = compWeekBounds(lastMs);
    expect(start.toISOString()).toBe('2026-07-10T06:00:00.000Z');
  });

  it('rolls to the next week one millisecond later', () => {
    const nextWeek = new Date('2026-07-17T06:00:00.000Z');
    const { start } = compWeekBounds(nextWeek);
    expect(start.toISOString()).toBe('2026-07-17T06:00:00.000Z');
  });

  it('spans exactly seven days', () => {
    const { start, end } = compWeekBounds(new Date('2026-02-11T00:00:00Z'));
    expect(end.getTime() - start.getTime()).toBe(7 * 86_400_000 - 1);
  });

  it('does NOT shift for daylight saving — the offset is fixed at UTC-6', () => {
    // January (no DST) and July (DST in most of the US) must behave identically.
    const winter = compWeekBounds(new Date('2026-01-14T12:00:00Z'));
    const summer = compWeekBounds(new Date('2026-07-15T12:00:00Z'));

    expect(winter.start.getUTCHours()).toBe(6);
    expect(summer.start.getUTCHours()).toBe(6);
  });

  it('formats a readable week label', () => {
    expect(formatCompWeek(new Date('2026-07-15T12:00:00Z'))).toBe(
      'Jul 10 – Jul 16 CST',
    );
  });
});

describe('generation payout date (the 5th)', () => {
  it('targets the 5th of this month when still before it', () => {
    expect(
      nextGenerationPayoutDate(new Date('2026-07-02T00:00:00Z')).toISOString(),
    ).toBe('2026-07-05T00:00:00.000Z');
  });

  it('rolls to next month once past the 5th', () => {
    expect(
      nextGenerationPayoutDate(new Date('2026-07-20T00:00:00Z')).toISOString(),
    ).toBe('2026-08-05T00:00:00.000Z');
  });

  it('rolls across a year boundary', () => {
    expect(
      nextGenerationPayoutDate(new Date('2026-12-20T00:00:00Z')).toISOString(),
    ).toBe('2027-01-05T00:00:00.000Z');
  });
});

// ─── §8 PII masking ─────────────────────────────────────────────────────────

describe('§8 — payout bank details are masked', () => {
  it('shows only the last four digits', () => {
    expect(maskAccountNumber('123456789012')).toBe('•••• 9012');
    expect(maskAccountNumber('****-****-1234')).toBe('•••• 1234');
  });

  it('handles an empty value', () => {
    expect(maskAccountNumber(null)).toBe('––––');
  });

  it('masks every sensitive key in a payout_details blob', () => {
    const masked = maskPayoutDetails({
      account_number: '123456789012',
      routing_number: '021000021',
      iban: 'GB33BUKB20201555555555',
      bank_name: 'Example Bank',
    });

    expect(masked.account_number).toBe('•••• 9012');
    expect(masked.routing_number).toBe('•••• 0021');
    expect(masked.iban).toBe('•••• 5555');
    // Non-sensitive fields pass through untouched.
    expect(masked.bank_name).toBe('Example Bank');
  });

  it('never leaks a full account number', () => {
    const masked = maskPayoutDetails({ account_number: '123456789012' });
    expect(JSON.stringify(masked)).not.toContain('123456789012');
  });
});

// ─── §37 cap ────────────────────────────────────────────────────────────────

describe('§37 payout cap', () => {
  it('caps customer orders at 50% of retail', () => {
    expect(payoutCapCents(10_000, 'customer')).toBe(5_000);
  });

  it('caps wholesale at 20%', () => {
    expect(payoutCapCents(10_000, 'wholesale')).toBe(2_000);
  });

  it('describes a trim', () => {
    expect(formatCapAdjustment(0)).toBe('Within §37 cap');
    expect(formatCapAdjustment(-250)).toBe('Trimmed $2.50 by the §37 cap');
  });
});
