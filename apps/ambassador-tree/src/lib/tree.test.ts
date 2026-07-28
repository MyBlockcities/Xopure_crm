import { describe, expect, it } from 'vitest';

import {
  GENERATION_QUALIFYING_RANK,
  isGenerationQualified,
  RANK_KEYS,
  rankLabel,
  rankOrdinal,
  toRankKey,
  UnmappedRankError,
} from './ranks';
import {
  type AmbassadorRow,
  buildTree,
  type TreeNode,
  findCycleIds,
  findNode,
  flatten,
  lineageOf,
  topByDownlineRevenue,
} from './tree';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const row = (
  id: string,
  parentId: string | null,
  depth: number,
  overrides: Partial<AmbassadorRow> = {},
): AmbassadorRow => ({
  id,
  parent_id: parentId,
  depth,
  name: `Ambassador ${id}`,
  email: `${id}@xopure.test`,
  status: 'approved',
  account_type: 'AMBASSADOR',
  paid_as_rank_key: 'starter',
  career_rank_key: 'starter',
  rank_key: 'starter',
  active_customer_count: 0,
  retail_cents: 0,
  cv_cents: 0,
  order_count: 0,
  commission_lifetime_cents: 0,
  needs_sponsor_review: false,
  joined_at: '2026-01-01T00:00:00Z',
  last_order_at: null,
  monthly_activity: [],
  ...overrides,
});

//        a
//      /   \
//     b     c
//    / \
//   d   e
//       |
//       f
const forest: AmbassadorRow[] = [
  row('a', null, 0, { retail_cents: 100 }),
  row('b', 'a', 1, { retail_cents: 200 }),
  row('c', 'a', 1, { retail_cents: 400 }),
  row('d', 'b', 2, { retail_cents: 800 }),
  row('e', 'b', 2, { retail_cents: 1600 }),
  row('f', 'e', 3, { retail_cents: 3200 }),
];

// ─── Ranks ──────────────────────────────────────────────────────────────────

describe('rank ladder', () => {
  it('maps every canonical key', () => {
    for (const key of RANK_KEYS) {
      expect(toRankKey(key)).toBe(key);
    }
  });

  it('does not silently downgrade influencer', () => {
    expect(toRankKey('influencer')).toBe('influencer');
    expect(rankLabel('influencer')).toBe('Influencer');
  });

  it('honours the permanent display-name offset', () => {
    expect(rankLabel('promoter')).toBe('Leader');
    expect(rankLabel('leader')).toBe('Executive');
  });

  it('never returns a label equal to the raw key', () => {
    for (const key of RANK_KEYS) {
      expect(rankLabel(key)).not.toBe(key);
    }
  });

  it('throws on an unknown rank instead of defaulting', () => {
    expect(() => toRankKey('grand_poobah')).toThrow(UnmappedRankError);
  });

  it('treats an absent rank as starter', () => {
    expect(toRankKey(null)).toBe('starter');
    expect(toRankKey(undefined)).toBe('starter');
    expect(toRankKey('')).toBe('starter');
  });

  it('accepts legacy aliases and odd casing', () => {
    expect(toRankKey('L3_PROMOTER')).toBe('promoter');
    expect(toRankKey('  Influencer ')).toBe('influencer');
  });

  it('orders the ladder ascending', () => {
    expect(rankOrdinal('customer')).toBeLessThan(rankOrdinal('starter'));
    expect(rankOrdinal('influencer')).toBeLessThan(rankOrdinal('promoter'));
    expect(rankOrdinal('director')).toBeLessThan(rankOrdinal('icon'));
  });

  it('gates generation at promoter (display Leader) and above', () => {
    expect(GENERATION_QUALIFYING_RANK).toBe('promoter');
    expect(isGenerationQualified('influencer')).toBe(false);
    expect(isGenerationQualified('promoter')).toBe(true);
    expect(isGenerationQualified('icon')).toBe(true);
  });
});

// ─── Tree building ──────────────────────────────────────────────────────────

describe('buildTree', () => {
  it('produces a single root for a connected tree', () => {
    const { roots, nodeCount } = buildTree(forest);
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe('a');
    expect(nodeCount).toBe(6);
  });

  it('nests children correctly', () => {
    const { roots } = buildTree(forest);
    const a = roots[0];
    expect(a.children.map((c) => c.id).sort()).toEqual(['b', 'c']);

    const b = a.children.find((c) => c.id === 'b')!;
    expect(b.children.map((c) => c.id).sort()).toEqual(['d', 'e']);
  });

  it('counts direct referrals', () => {
    const { roots } = buildTree(forest);
    const a = roots[0];
    expect(a.subtree.directReferralCount).toBe(2);
    expect(findNode(roots, 'c')!.subtree.directReferralCount).toBe(0);
  });

  it('counts the full downline at any depth', () => {
    const { roots } = buildTree(forest);
    expect(roots[0].subtree.downlineSize).toBe(5);
    expect(findNode(roots, 'b')!.subtree.downlineSize).toBe(3);
    expect(findNode(roots, 'e')!.subtree.downlineSize).toBe(1);
    expect(findNode(roots, 'f')!.subtree.downlineSize).toBe(0);
  });

  it('measures subtree depth with leaves at zero', () => {
    const { roots } = buildTree(forest);
    expect(roots[0].subtree.treeDepth).toBe(3);
    expect(findNode(roots, 'b')!.subtree.treeDepth).toBe(2);
    expect(findNode(roots, 'f')!.subtree.treeDepth).toBe(0);
  });

  it('rolls revenue up the tree inclusive of self', () => {
    const { roots } = buildTree(forest);
    // 100 + 200 + 400 + 800 + 1600 + 3200
    expect(roots[0].subtree.retailCents).toBe(6300);
    // b: 200 + 800 + 1600 + 3200
    expect(findNode(roots, 'b')!.subtree.retailCents).toBe(5800);
    expect(findNode(roots, 'f')!.subtree.retailCents).toBe(3200);
  });

  it('keeps self metrics separate from subtree metrics', () => {
    const { roots } = buildTree(forest);
    expect(roots[0].self.retailCents).toBe(100);
    expect(roots[0].subtree.retailCents).toBe(6300);
  });

  it('rolls up each commission rail without mixing weekly and monthly money', () => {
    const { roots } = buildTree([
      row('a', null, 0, {
        commission_paid_cents: 100,
        commission_payable_cents: 200,
        commission_held_cents: 300,
        commission_accrued_generation_cents: 400,
      }),
      row('b', 'a', 1, {
        commission_paid_cents: 10,
        commission_payable_cents: 20,
        commission_held_cents: 30,
        commission_accrued_generation_cents: 40,
      }),
    ]);

    expect(roots[0].subtree).toMatchObject({
      commissionPaidCents: 110,
      commissionPayableCents: 220,
      commissionHeldCents: 330,
      commissionAccruedGenerationCents: 440,
    });
    expect(roots[0].self.commissionPayableCents).toBe(200);
    expect(roots[0].self.commissionAccruedGenerationCents).toBe(400);
  });

  it('supports a forest with several roots', () => {
    const { roots } = buildTree([
      row('r1', null, 0),
      row('r2', null, 0),
      row('x', 'r1', 1),
    ]);
    expect(roots.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('re-roots a dangling parent_id and reports it', () => {
    const { roots, orphanIds } = buildTree([
      row('lost', 'ghost', 1),
      row('real', null, 0),
    ]);
    expect(orphanIds).toEqual(['lost']);
    expect(roots.map((r) => r.id).sort()).toEqual(['lost', 'real']);
  });

  it('breaks cycles instead of hanging, and reports them', () => {
    const { roots, cycleIds, nodeCount } = buildTree([
      row('x', 'z', 0),
      row('y', 'x', 1),
      row('z', 'y', 2),
    ]);
    expect([...cycleIds].sort()).toEqual(['x', 'y', 'z']);
    expect(nodeCount).toBe(3);
    expect(roots.length).toBeGreaterThan(0);
  });

  it('handles an empty result set', () => {
    const { roots, nodeCount } = buildTree([]);
    expect(roots).toEqual([]);
    expect(nodeCount).toBe(0);
  });

  it('survives a deep chain without stack overflow', () => {
    const deep: AmbassadorRow[] = [row('n0', null, 0)];
    for (let i = 1; i < 5000; i += 1) {
      deep.push(row(`n${i}`, `n${i - 1}`, i));
    }

    const { roots } = buildTree(deep);
    expect(roots).toHaveLength(1);
    expect(roots[0].subtree.downlineSize).toBe(4999);
    expect(roots[0].subtree.treeDepth).toBe(4999);
  });

  it('falls back through rank fields and never renders a raw key', () => {
    const { roots } = buildTree([
      row('a', null, 0, {
        paid_as_rank_key: null,
        career_rank_key: 'promoter',
        rank_key: 'starter',
      }),
    ]);
    expect(roots[0].paidAsRank).toBe('promoter');
    expect(rankLabel(roots[0].paidAsRank)).toBe('Leader');
  });

  it('derives a display name when name is missing', () => {
    const { roots } = buildTree([
      row('abcdef123456', null, 0, { name: null, email: 'x@y.z' }),
    ]);
    expect(roots[0].name).toBe('x@y.z');
  });
});

// ─── Navigation ─────────────────────────────────────────────────────────────

describe('navigation', () => {
  it('finds a node anywhere in the forest', () => {
    const { roots } = buildTree(forest);
    expect(findNode(roots, 'f')!.id).toBe('f');
    expect(findNode(roots, 'nope')).toBeNull();
  });

  it('returns the lineage root-first', () => {
    const { roots } = buildTree(forest);
    expect(lineageOf(roots, 'f').map((n) => n.id)).toEqual(['a', 'b', 'e', 'f']);
  });

  it('returns a single-element lineage for a root', () => {
    const { roots } = buildTree(forest);
    expect(lineageOf(roots, 'a').map((n) => n.id)).toEqual(['a']);
  });

  it('flattens every node exactly once', () => {
    const { roots } = buildTree(forest);
    const ids = flatten(roots).map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('ranks by downline revenue', () => {
    const { roots } = buildTree(forest);
    const top = topByDownlineRevenue(roots, 3);
    expect(top.map((n) => n.id)).toEqual(['a', 'b', 'e']);
  });
});

describe('findCycleIds', () => {
  it('reports nothing for a clean tree', () => {
    expect(findCycleIds(forest)).toEqual([]);
  });

  it('identifies exactly the cycle members', () => {
    const ids = findCycleIds([
      row('x', 'z', 0),
      row('y', 'x', 1),
      row('z', 'y', 2),
      row('clean', null, 0),
    ]);
    expect(ids.sort()).toEqual(['x', 'y', 'z']);
  });
});

// ─── Driver numeric coercion ────────────────────────────────────────────────
// node-postgres returns bigint/numeric as strings. If those are not coerced,
// every rolled-up money figure silently reads as $0.00.

describe('bigint-as-string rows from node-postgres', () => {
  const stringy = buildTree([
    row('a', null, 0, {
      retail_cents: '1311300',
      cv_cents: '655650',
      order_count: '4',
      commission_lifetime_cents: '89624',
      active_customer_count: '7',
    }),
    row('b', 'a', 1, { retail_cents: '1000', cv_cents: '500', order_count: '1' }),
  ]);

  const root = stringy.roots[0] as TreeNode;

  it('parses string money into self metrics', () => {
    expect(root.self.retailCents).toBe(1_311_300);
    expect(root.self.cvCents).toBe(655_650);
    expect(root.self.commissionLifetimeCents).toBe(89_624);
  });

  it('parses string counts', () => {
    expect(root.self.orderCount).toBe(4);
    expect(root.self.activeCustomerCount).toBe(7);
  });

  it('sums string values across the subtree rather than zeroing them', () => {
    expect(root.subtree.retailCents).toBe(1_312_300);
    expect(root.subtree.orderCount).toBe(5);
  });

  it('still treats genuine non-numerics as 0', () => {
    const junk = buildTree([row('x', null, 0, { retail_cents: 'not-a-number' })]);

    expect((junk.roots[0] as TreeNode).self.retailCents).toBe(0);
  });
});
