/**
 * XO Pure display rules — these are LAW (Developer Guide §2 / COMP_PLAN_LAW §38.1).
 *
 * "A number shown against the wrong basis reads as a bug even when the math is
 * right."
 *
 * Every rule in guide §2 and §8 is encoded here so display correctness is
 * enforced by the type system and the tests, not by convention:
 *
 *   §2.1  rank labels are spec display names, never internal keys  (see ranks.ts)
 *   §2.2  every rate states its basis — never a bare percentage
 *   §2.3  CV vs retail — CV is 50% of retail; show both when relevant
 *   §2.4  status wording is fixed
 *   §2.5  generation is monthly — never inside a weekly payable total
 *   §2.6  an unmappable pay area is surfaced, never silently dropped
 *   §8    money is integer cents; comp week is Fri 00:00 → Thu 23:59 CST (UTC-6)
 *   §8    payout bank details are masked to last4
 */

// ─── Money (§8: integer cents everywhere; divide by 100 only at render) ──────

export const formatCents = (
  cents: number | null | undefined,
  options: { readonly currency?: string; readonly showCents?: boolean } = {},
): string => {
  const { currency = 'USD', showCents = true } = options;
  const value = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value / 100);
};

/** CV is 50% of retail (§1.2). Derive it only when the ledger has not supplied it. */
export const cvFromRetailCents = (retailCents: number): number =>
  Math.round(retailCents * 0.5);

/**
 * §2.3 — show both bases when relevant.
 * e.g. "$120.00 retail · $60.00 CV"
 */
export const formatRetailAndCv = (
  retailCents: number,
  cvCents?: number | null,
): string => {
  const cv = cvCents ?? cvFromRetailCents(retailCents);

  return `${formatCents(retailCents)} retail · ${formatCents(cv)} CV`;
};

// ─── Basis (§2.2: never a bare percentage) ──────────────────────────────────

/** The basis a rate is computed against. A rate without one is meaningless. */
export type Basis = 'retail' | 'CV' | 'wholesale';

/**
 * Render a rate with its basis. This is the ONLY sanctioned way to show a
 * percentage.
 *
 * formatRate(25, 'retail')  -> "25% of retail"
 * formatRate(30, 'CV')      -> "30% of CV"
 */
export const formatRate = (percent: number, basis: Basis): string =>
  `${trimPercent(percent)}% of ${basis}`;

const trimPercent = (percent: number): string =>
  Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(2)));

/** Basis points → percent. The ledger stores `percentage_bps`. */
export const bpsToPercent = (bps: number): number => bps / 100;

// ─── Pay areas (§1.4) ───────────────────────────────────────────────────────

export type PayCycle = 'weekly' | 'monthly';

export interface PayAreaDefinition {
  readonly code: string;
  /** Short human label for tables and legends. */
  readonly label: string;
  /** Which bucket of the comp plan this belongs to. */
  readonly group:
    | 'Customer commission'
    | 'Team pool'
    | 'Generation'
    | 'Team pay'
    | 'Wholesale';
  readonly basis: Basis;
  readonly payCycle: PayCycle;
  /** Pool seat number, when this pay area is a pool seat. */
  readonly seat?: number;
  /** Total seats in the pool. */
  readonly seatsTotal?: number;
  /** Generation or level depth, when applicable. */
  readonly depth?: number;
  /** Superseded by §36 on 2026-07-25; kept for history. */
  readonly legacy?: boolean;
  /** Full description, basis included. */
  readonly description: string;
}

const seatPool = (
  code: string,
  seat: number,
  opts: {
    readonly group: PayAreaDefinition['group'];
    readonly basis: Basis;
    readonly poolPercent: number;
    readonly poolLabel: string;
    readonly legacy?: boolean;
  },
): PayAreaDefinition => ({
  code,
  label: `${opts.poolLabel} · seat ${seat} of 4`,
  group: opts.group,
  basis: opts.basis,
  payCycle: 'weekly',
  seat,
  seatsTotal: 4,
  legacy: opts.legacy,
  // §2.2: a seat is 1.25% of the pool basis — never show a bare "1.25%".
  description: `${opts.poolPercent}% ${opts.poolLabel} of ${opts.basis} · seat ${seat} of 4`,
});

export const PAY_AREAS: Readonly<Record<string, PayAreaDefinition>> = Object.freeze({
  // A. Customer order — Way 01, on RETAIL, never compresses
  CUSTOMER_SALES: {
    code: 'CUSTOMER_SALES',
    label: 'Customer commission (Way 01)',
    group: 'Customer commission',
    basis: 'retail',
    payCycle: 'weekly',
    description:
      'Way 01 customer commission — 25/30/35/40% of retail by monthly Customer-PV tier. Never compresses.',
  },

  // Customer Team Pool — 5% of retail, 4 seats, topmost absorbs unfilled
  TEAM_POOL_S1: seatPool('TEAM_POOL_S1', 1, {
    group: 'Team pool',
    basis: 'retail',
    poolPercent: 5,
    poolLabel: 'Team Pool',
  }),
  TEAM_POOL_S2: seatPool('TEAM_POOL_S2', 2, {
    group: 'Team pool',
    basis: 'retail',
    poolPercent: 5,
    poolLabel: 'Team Pool',
  }),
  TEAM_POOL_S3: seatPool('TEAM_POOL_S3', 3, {
    group: 'Team pool',
    basis: 'retail',
    poolPercent: 5,
    poolLabel: 'Team Pool',
  }),
  TEAM_POOL_S4: seatPool('TEAM_POOL_S4', 4, {
    group: 'Team pool',
    basis: 'retail',
    poolPercent: 5,
    poolLabel: 'Team Pool',
  }),

  // Generation (§36, since 2026-07-25) — flat 4% of CV, MONTHLY/accrued
  ...generationAreas(),

  // B. Ambassador order — rank card × CV, L1–L4
  ...teamLevelAreas(),

  // C. Wholesale
  WHOLESALE_DIRECT: {
    code: 'WHOLESALE_DIRECT',
    label: 'Wholesale direct',
    group: 'Wholesale',
    basis: 'wholesale',
    payCycle: 'weekly',
    description: '10% of wholesale subtotal to the enroller.',
  },
  ...wholesalePoolAreas(),

  // Legacy customer generation pool, pre-2026-07-25 (§1.4A)
  ...legacyGenPoolAreas(),
});

function generationAreas(): Record<string, PayAreaDefinition> {
  const out: Record<string, PayAreaDefinition> = {};

  for (let g = 1; g <= 4; g += 1) {
    out[`GENERATION_G${g}`] = {
      code: `GENERATION_G${g}`,
      label: `Generation ${g}`,
      group: 'Generation',
      basis: 'CV',
      payCycle: 'monthly',
      depth: g,
      description: `4% of CV · generation ${g}`,
    };
  }

  return out;
}

function teamLevelAreas(): Record<string, PayAreaDefinition> {
  const out: Record<string, PayAreaDefinition> = {};

  for (let l = 1; l <= 4; l += 1) {
    out[`TEAM_L${l}`] = {
      code: `TEAM_L${l}`,
      label: `Team pay L${l}`,
      group: 'Team pay',
      basis: 'CV',
      payCycle: 'weekly',
      depth: l,
      description: `Rank-card team pay · level ${l} · % of CV at the receiver's rate`,
    };
  }

  return out;
}

function wholesalePoolAreas(): Record<string, PayAreaDefinition> {
  const out: Record<string, PayAreaDefinition> = {};

  for (let s = 1; s <= 4; s += 1) {
    out[`WHOLESALE_TEAM_S${s}`] = seatPool(`WHOLESALE_TEAM_S${s}`, s, {
      group: 'Wholesale',
      basis: 'wholesale',
      poolPercent: 5,
      poolLabel: 'Wholesale Team Pool',
    });
    out[`WHOLESALE_GEN_S${s}`] = seatPool(`WHOLESALE_GEN_S${s}`, s, {
      group: 'Wholesale',
      basis: 'wholesale',
      poolPercent: 5,
      poolLabel: 'Wholesale Gen Pool',
    });
  }

  return out;
}

function legacyGenPoolAreas(): Record<string, PayAreaDefinition> {
  const out: Record<string, PayAreaDefinition> = {};

  for (let s = 1; s <= 4; s += 1) {
    out[`GEN_POOL_S${s}`] = seatPool(`GEN_POOL_S${s}`, s, {
      group: 'Generation',
      basis: 'retail',
      poolPercent: 5,
      poolLabel: 'legacy Gen Pool',
      legacy: true,
    });
  }

  return out;
}

/** §36 cutover. Customer generation rows paid before this use the old 5% Gen Pool. */
export const GENERATION_CUTOVER_ISO = '2026-07-25T00:00:00Z';

export class UnmappedPayAreaError extends Error {
  constructor(readonly rawValue: unknown) {
    super(
      `Unmapped pay area ${JSON.stringify(rawValue)}. Guide §2.6: a pay area ` +
        `the CRM cannot map must be surfaced, never silently dropped.`,
    );
    this.name = 'UnmappedPayAreaError';
  }
}

export const payArea = (code: unknown): PayAreaDefinition => {
  const key = String(code ?? '').trim().toUpperCase();
  const found = PAY_AREAS[key];

  if (!found) throw new UnmappedPayAreaError(code);

  return found;
};

/**
 * §2.6 — non-throwing variant for list rendering. Returns an explicit
 * "unmapped" placeholder so the row is still shown, flagged, and never dropped.
 */
export const payAreaOrUnmapped = (
  code: unknown,
): PayAreaDefinition & { readonly unmapped: boolean } => {
  try {
    return { ...payArea(code), unmapped: false };
  } catch {
    const raw = String(code ?? '(blank)');

    return {
      code: raw,
      label: `⚠ Unmapped pay area: ${raw}`,
      group: 'Customer commission',
      basis: 'retail',
      payCycle: 'weekly',
      description: `Unmapped pay area "${raw}" — surfaced per §2.6. Add it to PAY_AREAS.`,
      unmapped: true,
    };
  }
};

/**
 * The sanctioned label for a single ledger row's rate.
 *
 * Generation → "4% of CV · generation 2"
 * Pool seat  → "5% Team Pool of retail · seat 2 of 4"
 * Way 01     → "25% of retail"
 */
export const describeLedgerRate = (
  payAreaCode: unknown,
  percent?: number | null,
): string => {
  const area = payAreaOrUnmapped(payAreaCode);

  if (area.unmapped) return area.label;

  // Pool seats and generation carry their own fully-qualified description.
  if (area.seat !== undefined || area.group === 'Generation') {
    return area.legacy ? `${area.description} (legacy Gen Pool)` : area.description;
  }

  if (percent === null || percent === undefined) return area.description;

  return `${formatRate(percent, area.basis)}${
    area.depth !== undefined ? ` · level ${area.depth}` : ''
  }`;
};

// ─── Status (§2.4: wording is fixed) ────────────────────────────────────────

export type LedgerStatus =
  | 'held'
  | 'payable'
  | 'paid'
  | 'accrued'
  | 'reversed'
  | 'voided';

export const LEDGER_STATUS_LABELS: Readonly<Record<LedgerStatus, string>> =
  Object.freeze({
    held: 'Clearing (7-day hold)',
    payable: 'Payable — next Friday',
    paid: 'Paid',
    accrued: 'Generation — pays on the 5th',
    reversed: 'Reversed',
    voided: 'Voided',
  });

export const ledgerStatusLabel = (status: unknown): string => {
  const key = String(status ?? '').trim().toLowerCase() as LedgerStatus;

  return LEDGER_STATUS_LABELS[key] ?? `⚠ Unknown status: ${String(status)}`;
};

/** Statuses that represent real, countable money. */
const LIVE_STATUSES = new Set<LedgerStatus>(['held', 'payable', 'paid', 'accrued']);

export const isLiveStatus = (status: unknown): boolean =>
  LIVE_STATUSES.has(String(status ?? '').toLowerCase() as LedgerStatus);

// ─── Totals (§2.5: generation is monthly and must stay separate) ────────────

export interface LedgerRowLike {
  readonly pay_area?: unknown;
  readonly status?: unknown;
  readonly amount_cents?: number | null;
  readonly pay_cycle?: unknown;
}

export interface CommissionTotals {
  /** Weekly rail: held + payable, EXCLUDING all generation. */
  readonly weeklyPayableCents: number;
  readonly weeklyHeldCents: number;
  /** Monthly rail: accrued generation, paid on the 5th. */
  readonly accruedGenerationCents: number;
  readonly paidCents: number;
  readonly reversedCents: number;
  /** Rows whose pay area could not be mapped. Must be surfaced (§2.6). */
  readonly unmappedRows: readonly LedgerRowLike[];
}

const isMonthlyRow = (row: LedgerRowLike): boolean => {
  if (String(row.pay_cycle ?? '').toLowerCase() === 'monthly') return true;

  const area = payAreaOrUnmapped(row.pay_area);

  return !area.unmapped && area.payCycle === 'monthly';
};

/**
 * Bucket a ledger into its rails.
 *
 * §2.5 is enforced structurally: accrued/monthly generation can never land in
 * `weeklyPayableCents`, because the two are computed from disjoint predicates.
 */
export const summarizeLedger = (
  rows: readonly LedgerRowLike[],
): CommissionTotals => {
  let weeklyPayableCents = 0;
  let weeklyHeldCents = 0;
  let accruedGenerationCents = 0;
  let paidCents = 0;
  let reversedCents = 0;
  const unmappedRows: LedgerRowLike[] = [];

  for (const row of rows) {
    const amount = typeof row.amount_cents === 'number' ? row.amount_cents : 0;
    const status = String(row.status ?? '').toLowerCase();

    if (payAreaOrUnmapped(row.pay_area).unmapped) unmappedRows.push(row);

    switch (status) {
      case 'paid':
        paidCents += amount;
        break;
      case 'reversed':
      case 'voided':
        reversedCents += amount;
        break;
      case 'accrued':
        accruedGenerationCents += amount;
        break;
      case 'payable':
        // Generation never joins the weekly rail, even if mis-statused.
        if (isMonthlyRow(row)) accruedGenerationCents += amount;
        else weeklyPayableCents += amount;
        break;
      case 'held':
        if (isMonthlyRow(row)) accruedGenerationCents += amount;
        else weeklyHeldCents += amount;
        break;
      default:
        break;
    }
  }

  return {
    weeklyPayableCents,
    weeklyHeldCents,
    accruedGenerationCents,
    paidCents,
    reversedCents,
    unmappedRows,
  };
};

// ─── Comp week (§8: Fri 00:00 → Thu 23:59 CST, UTC-6 FIXED, no DST) ─────────

/** CST is fixed at UTC-6 for comp purposes. Do not apply daylight saving. */
export const COMP_TZ_OFFSET_HOURS = -6;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * The Fri 00:00 → Thu 23:59:59.999 CST commission week containing `instant`,
 * returned as UTC instants.
 */
export const compWeekBounds = (
  instant: Date,
): { readonly start: Date; readonly end: Date } => {
  // Shift into fixed-offset CST wall-clock space.
  const shifted = new Date(instant.getTime() + COMP_TZ_OFFSET_HOURS * HOUR_MS);

  // getUTCDay on the shifted value gives the CST weekday. Friday = 5.
  const daysSinceFriday = (shifted.getUTCDay() - 5 + 7) % 7;

  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceFriday,
  );

  const start = new Date(startShifted - COMP_TZ_OFFSET_HOURS * HOUR_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS - 1);

  return { start, end };
};

/** Generation pays on the 5th of the following month (§1.6). */
export const nextGenerationPayoutDate = (instant: Date): Date => {
  const year = instant.getUTCFullYear();
  const month = instant.getUTCMonth();
  const dayFive = Date.UTC(year, month, 5);

  return instant.getTime() < dayFive
    ? new Date(dayFive)
    : new Date(Date.UTC(year, month + 1, 5));
};

export const formatCompWeek = (instant: Date): string => {
  const { start, end } = compWeekBounds(instant);
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(d.getTime() + COMP_TZ_OFFSET_HOURS * HOUR_MS));

  return `${fmt(start)} – ${fmt(end)} CST`;
};

// ─── PII masking (§8 / §3.4) ────────────────────────────────────────────────

/**
 * `payout_details` contains bank information. The CRM must NEVER display a full
 * account or routing number.
 */
export const maskAccountNumber = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length === 0) return '––––';

  return `•••• ${digits.slice(-4)}`;
};

/** Whole-object guard: strips anything that looks like bank detail. */
const SENSITIVE_KEYS = /account|routing|iban|swift|tax_id|ssn/i;

export const maskPayoutDetails = (
  details: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  if (!details) return {};

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    out[key] = SENSITIVE_KEYS.test(key) ? maskAccountNumber(value) : value;
  }

  return out;
};

// ─── §37 cap ────────────────────────────────────────────────────────────────

/** Total field payout ceiling: 50% of retail, or 20% on wholesale. */
export const payoutCapCents = (
  basisCents: number,
  orderType: 'customer' | 'wholesale',
): number => Math.round(basisCents * (orderType === 'wholesale' ? 0.2 : 0.5));

export const formatCapAdjustment = (capAdjustmentCents: number): string =>
  capAdjustmentCents === 0
    ? 'Within §37 cap'
    : `Trimmed ${formatCents(Math.abs(capAdjustmentCents))} by the §37 cap`;
