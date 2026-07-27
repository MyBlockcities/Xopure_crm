/**
 * Deterministic demo forest.
 *
 * Lets the renderer be developed and reviewed without production credentials.
 * It is pure and seeded, so a screenshot is reproducible.
 *
 * This is FICTION. It never touches Supabase and must never be presented as
 * real ambassador data — the API labels every demo response `"source": "demo"`.
 */

import { RANK_KEYS, type RankKey } from './ranks';
import { type AmbassadorRow, type MonthlyActivity } from './tree';

/** Small deterministic PRNG (mulberry32) so the same seed gives the same tree. */
const rng = (seed: number) => {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FIRST = [
  'Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ezra', 'Iris', 'Kai', 'Nina', 'Omar',
  'Ruby', 'Sage', 'Theo', 'Vera', 'Wren', 'Yusuf', 'Cleo', 'Dario', 'Elle', 'Finn',
];

const LAST = [
  'Alvarez', 'Bennett', 'Cho', 'Duval', 'Ellis', 'Farah', 'Gupta', 'Hayes',
  'Ibarra', 'Jensen', 'Kowal', 'Lindqvist', 'Moreau', 'Nakamura', 'Okafor', 'Pena',
];

const monthsBack = (count: number, random: () => number): MonthlyActivity[] => {
  const now = new Date('2026-07-01T00:00:00Z');
  const out: MonthlyActivity[] = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const orderCount = Math.floor(random() * 9);

    out.push({
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      orderCount,
      retailCents: orderCount * (6_000 + Math.floor(random() * 14_000)),
    });
  }

  return out;
};

export interface DemoOptions {
  readonly seed?: number;
  /** Roughly how many ambassadors to generate. */
  readonly size?: number;
  readonly maxDepth?: number;
}

/**
 * Generate a plausible downline: a few strong legs, a long tail of leaves,
 * one flagged orphan, and rank distribution skewed toward the bottom of the
 * ladder — which is what a real genealogy looks like.
 */
export const demoRows = (options: DemoOptions = {}): AmbassadorRow[] => {
  const { seed = 7, size = 140, maxDepth = 6 } = options;
  const random = rng(seed);

  const pick = <T>(items: readonly T[]): T =>
    items[Math.floor(random() * items.length)] as T;

  // Rank skew: most people sit at the bottom of the ladder.
  const rankFor = (depth: number): RankKey => {
    const roll = random();
    const ceiling = Math.max(1, RANK_KEYS.length - depth);

    if (roll > 0.93) return RANK_KEYS[Math.min(ceiling, 7)] as RankKey;
    if (roll > 0.78) return RANK_KEYS[Math.min(ceiling, 4)] as RankKey;
    if (roll > 0.5) return RANK_KEYS[Math.min(ceiling, 2)] as RankKey;

    return roll > 0.12 ? 'starter' : 'customer';
  };

  const rows: AmbassadorRow[] = [];
  const frontier: { id: string; depth: number }[] = [];

  const make = (
    id: string,
    parentId: string | null,
    depth: number,
    overrides: Partial<AmbassadorRow> = {},
  ): AmbassadorRow => {
    const rank = rankFor(depth);
    const orderCount = Math.floor(random() * 24);
    const retailCents = orderCount * (5_000 + Math.floor(random() * 25_000));

    return {
      id,
      parent_id: parentId,
      depth,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      email: `${id}@demo.xopure.test`,
      status: random() > 0.08 ? 'approved' : 'pending',
      account_type: rank === 'customer' ? 'CUSTOMER_ONLY' : 'AMBASSADOR',
      paid_as_rank_key: rank,
      career_rank_key: rank,
      rank_key: rank,
      active_customer_count: Math.floor(random() * 9),
      retail_cents: retailCents,
      cv_cents: Math.round(retailCents * 0.5),
      order_count: orderCount,
      commission_lifetime_cents: Math.round(retailCents * (0.1 + random() * 0.25)),
      needs_sponsor_review: random() > 0.94,
      joined_at: new Date(
        Date.UTC(2024, Math.floor(random() * 30), 1 + Math.floor(random() * 27)),
      ).toISOString(),
      last_order_at:
        orderCount > 0
          ? new Date(
              Date.UTC(2026, Math.floor(random() * 7), 1 + Math.floor(random() * 27)),
            ).toISOString()
          : null,
      monthly_activity: monthsBack(12, random),
      ...overrides,
    };
  };

  const root = make('demo-root', null, 0, {
    name: 'XO Pure — House Account',
    paid_as_rank_key: 'icon',
    career_rank_key: 'icon',
    rank_key: 'icon',
    account_type: 'AMBASSADOR',
    status: 'approved',
    needs_sponsor_review: false,
  });

  rows.push(root);
  frontier.push({ id: root.id, depth: 0 });

  let counter = 0;

  while (rows.length < size && frontier.length > 0) {
    const parent = frontier.shift();
    if (!parent) break;
    if (parent.depth >= maxDepth) continue;

    // Wide at the top, narrow further down — the shape referral trees take.
    const branching = parent.depth === 0 ? 5 : Math.floor(random() * 4);

    for (let i = 0; i < branching && rows.length < size; i += 1) {
      counter += 1;
      const id = `demo-${counter.toString().padStart(3, '0')}`;
      rows.push(make(id, parent.id, parent.depth + 1));
      frontier.push({ id, depth: parent.depth + 1 });
    }
  }

  // A genuine orphan — parent_id null, flagged for sponsor review (guide §5).
  rows.push(
    make('demo-orphan', null, 0, {
      name: 'Unattributed Signup',
      needs_sponsor_review: true,
      paid_as_rank_key: 'starter',
      career_rank_key: 'starter',
      rank_key: 'starter',
    }),
  );

  return rows;
};
