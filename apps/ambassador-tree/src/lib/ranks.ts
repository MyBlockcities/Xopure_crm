/**
 * XO Pure comp-plan rank ladder — the single source of display truth.
 *
 * COMP_PLAN_LAW §1.5: the internal keys are PERMANENT; only display names
 * change. §2.1: never surface the raw key.
 *
 * ⚠ The key offset is a permanent hazard:
 *     internal `promoter` displays as "Leader"
 *     internal `leader`   displays as "Executive"
 */

export const RANK_KEYS = [
  'customer',
  'starter',
  'builder',
  'influencer',
  'promoter',
  'leader',
  'director',
  'icon',
] as const;

export type RankKey = (typeof RANK_KEYS)[number];

export interface RankDefinition {
  readonly key: RankKey;
  /** Spec display name. This is the ONLY string that may reach the UI. */
  readonly label: string;
  /** Ladder position, 0 = lowest. */
  readonly ordinal: number;
  /** Required personal-customer count. */
  readonly customers: number;
  /** Required group volume, in cents. */
  readonly gvCents: number;
  /** Personal qualification purchase threshold, in cents. */
  readonly pqpCents: number;
  /** Tier colour — one hue family per tier (design system, Phase 9). */
  readonly color: string;
}

export const RANKS: Readonly<Record<RankKey, RankDefinition>> = Object.freeze({
  customer: {
    key: 'customer',
    label: 'Customer',
    ordinal: 0,
    customers: 0,
    gvCents: 0,
    pqpCents: 0,
    color: '#64748b',
  },
  starter: {
    key: 'starter',
    label: 'Ambassador',
    ordinal: 1,
    customers: 0,
    gvCents: 0,
    pqpCents: 8_000,
    color: '#3b82f6',
  },
  builder: {
    key: 'builder',
    label: 'Partner',
    ordinal: 2,
    customers: 2,
    gvCents: 50_000,
    pqpCents: 10_000,
    color: '#06b6d4',
  },
  influencer: {
    key: 'influencer',
    label: 'Influencer',
    ordinal: 3,
    customers: 3,
    gvCents: 250_000,
    pqpCents: 25_000,
    color: '#10b981',
  },
  promoter: {
    key: 'promoter',
    label: 'Leader',
    ordinal: 4,
    customers: 4,
    gvCents: 500_000,
    pqpCents: 50_000,
    color: '#eab308',
  },
  leader: {
    key: 'leader',
    label: 'Executive',
    ordinal: 5,
    customers: 5,
    gvCents: 1_000_000,
    pqpCents: 50_000,
    color: '#f97316',
  },
  director: {
    key: 'director',
    label: 'Director',
    ordinal: 6,
    customers: 6,
    gvCents: 2_500_000,
    pqpCents: 50_000,
    color: '#ec4899',
  },
  icon: {
    key: 'icon',
    label: 'Visionary',
    ordinal: 7,
    customers: 8,
    gvCents: 5_000_000,
    pqpCents: 50_000,
    color: '#a855f7',
  },
});

/**
 * "Qualified leader" for generation payouts = internal `promoter`+
 * = display "Leader"+ (guide §1.5).
 */
export const GENERATION_QUALIFYING_RANK: RankKey = 'promoter';

const RANK_ALIASES: Readonly<Record<string, RankKey>> = Object.freeze({
  customer: 'customer',
  starter: 'starter',
  builder: 'builder',
  influencer: 'influencer',
  promoter: 'promoter',
  leader: 'leader',
  director: 'director',
  icon: 'icon',
  // legacy / historical variants
  l0_customer: 'customer',
  l1_starter: 'starter',
  affiliate: 'starter',
  active_affiliate: 'starter',
  l2_builder: 'builder',
  l3_promoter: 'promoter',
  l4_leader: 'leader',
  l5_director: 'director',
  l6_icon: 'icon',
});

export class UnmappedRankError extends Error {
  constructor(readonly rawValue: unknown) {
    super(
      `Unmapped rank ${JSON.stringify(rawValue)}. Add it to RANK_ALIASES — ` +
        `never let a rank silently fall back (COMP_PLAN_LAW §2.6).`,
    );
    this.name = 'UnmappedRankError';
  }
}

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * Resolve a raw Supabase rank value to a canonical key.
 * Throws on an unrecognised value rather than defaulting (LAW §2.6).
 * An absent value resolves to `starter` — that is missing, not unknown.
 */
export const toRankKey = (raw: unknown): RankKey => {
  const normalized = normalize(raw);

  if (!normalized) return 'starter';

  const mapped = RANK_ALIASES[normalized];

  if (!mapped) throw new UnmappedRankError(raw);

  return mapped;
};

/** The display name. Never render the key itself. */
export const rankLabel = (raw: unknown): string => RANKS[toRankKey(raw)].label;

export const rankColor = (raw: unknown): string => RANKS[toRankKey(raw)].color;

export const rankOrdinal = (raw: unknown): number => RANKS[toRankKey(raw)].ordinal;

export const isGenerationQualified = (raw: unknown): boolean =>
  rankOrdinal(raw) >= RANKS[GENERATION_QUALIFYING_RANK].ordinal;

/** Ladder order, lowest → highest. Useful for legends and axes. */
export const RANK_LADDER: readonly RankDefinition[] = Object.freeze(
  RANK_KEYS.map((key) => RANKS[key]),
);
