import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  centsToAmountMicros,
  computeTreeRollups,
  detectCycles,
  findAttentionNeeded,
  GENERATION_QUALIFYING_RANK,
  isGenerationQualified,
  isInGoodStanding,
  mapAccountType,
  mapAffiliateRank,
  mapAmbassadorStatus,
  RANK_ORDER,
  rankDisplayName,
  rankOrdinal,
  UnmappedRankError,
} from './comp-plan.mjs';

describe('rank ladder', () => {
  it('maps all eight canonical Supabase keys', () => {
    assert.equal(mapAffiliateRank('customer'), 'CUSTOMER');
    assert.equal(mapAffiliateRank('starter'), 'STARTER');
    assert.equal(mapAffiliateRank('builder'), 'BUILDER');
    assert.equal(mapAffiliateRank('influencer'), 'INFLUENCER');
    assert.equal(mapAffiliateRank('promoter'), 'PROMOTER');
    assert.equal(mapAffiliateRank('leader'), 'LEADER');
    assert.equal(mapAffiliateRank('director'), 'DIRECTOR');
    assert.equal(mapAffiliateRank('icon'), 'ICON');
  });

  // Regression: `influencer` was missing from the old rankMap and fell through
  // to `?? 'L1_STARTER'`, so every Influencer displayed as a Starter.
  it('does not silently downgrade influencer to starter', () => {
    assert.equal(mapAffiliateRank('influencer'), 'INFLUENCER');
    assert.notEqual(mapAffiliateRank('influencer'), 'STARTER');
    assert.equal(rankDisplayName(mapAffiliateRank('influencer')), 'Influencer');
  });

  it('honours the permanent display-name offset', () => {
    // internal `promoter` displays as "Leader"
    assert.equal(rankDisplayName(mapAffiliateRank('promoter')), 'Leader');
    // internal `leader` displays as "Executive"
    assert.equal(rankDisplayName(mapAffiliateRank('leader')), 'Executive');
  });

  it('never displays a raw internal key', () => {
    for (const key of RANK_ORDER) {
      const display = rankDisplayName(key);
      assert.notEqual(display, key);
      assert.ok(display.length > 0);
    }
  });

  it('throws on an unknown rank rather than defaulting', () => {
    assert.throws(() => mapAffiliateRank('grand_poobah'), UnmappedRankError);
    assert.throws(() => mapAffiliateRank('L9_WIZARD'), UnmappedRankError);
  });

  it('treats an absent rank as starter, which is not the same as unknown', () => {
    assert.equal(mapAffiliateRank(null), 'STARTER');
    assert.equal(mapAffiliateRank(undefined), 'STARTER');
    assert.equal(mapAffiliateRank(''), 'STARTER');
    assert.equal(mapAffiliateRank('   '), 'STARTER');
  });

  it('accepts legacy L-prefixed aliases', () => {
    assert.equal(mapAffiliateRank('L0_CUSTOMER'), 'CUSTOMER');
    assert.equal(mapAffiliateRank('L3_PROMOTER'), 'PROMOTER');
    assert.equal(mapAffiliateRank('L6_ICON'), 'ICON');
  });

  it('normalizes casing, spacing and punctuation', () => {
    assert.equal(mapAffiliateRank('  Influencer  '), 'INFLUENCER');
    assert.equal(mapAffiliateRank('l4-leader'), 'LEADER');
  });

  it('orders the ladder correctly', () => {
    assert.ok(rankOrdinal('CUSTOMER') < rankOrdinal('STARTER'));
    assert.ok(rankOrdinal('BUILDER') < rankOrdinal('INFLUENCER'));
    assert.ok(rankOrdinal('INFLUENCER') < rankOrdinal('PROMOTER'));
    assert.ok(rankOrdinal('PROMOTER') < rankOrdinal('LEADER'));
    assert.ok(rankOrdinal('DIRECTOR') < rankOrdinal('ICON'));
  });

  it('gates generation payouts at promoter (display Leader) and above', () => {
    assert.equal(GENERATION_QUALIFYING_RANK, 'PROMOTER');
    assert.equal(isGenerationQualified('INFLUENCER'), false);
    assert.equal(isGenerationQualified('PROMOTER'), true);
    assert.equal(isGenerationQualified('LEADER'), true);
    assert.equal(isGenerationQualified('ICON'), true);
  });
});

describe('status', () => {
  it('maps onto the xopureAmbassador status enum', () => {
    assert.equal(mapAmbassadorStatus('approved'), 'APPROVED');
    assert.equal(mapAmbassadorStatus('active'), 'ACTIVE');
    assert.equal(mapAmbassadorStatus('pending'), 'APPLIED');
    assert.equal(mapAmbassadorStatus('suspended'), 'PAUSED');
    assert.equal(mapAmbassadorStatus('rejected'), 'REJECTED');
  });

  it('defaults an unknown status to APPLIED', () => {
    assert.equal(mapAmbassadorStatus('who_knows'), 'APPLIED');
    assert.equal(mapAmbassadorStatus(null), 'APPLIED');
  });

  it('gates good standing on approved only', () => {
    assert.equal(isInGoodStanding('approved'), true);
    assert.equal(isInGoodStanding('APPROVED'), true);
    assert.equal(isInGoodStanding('active'), false);
    assert.equal(isInGoodStanding('pending'), false);
    assert.equal(isInGoodStanding(null), false);
  });

  it('maps account type', () => {
    assert.equal(mapAccountType('AMBASSADOR'), 'AMBASSADOR');
    assert.equal(mapAccountType('CUSTOMER_ONLY'), 'CUSTOMER_ONLY');
    assert.equal(mapAccountType(null), 'AMBASSADOR');
  });
});

describe('money', () => {
  it('converts integer cents to Twenty micros', () => {
    assert.equal(centsToAmountMicros(0), 0);
    assert.equal(centsToAmountMicros(1), 10_000);
    assert.equal(centsToAmountMicros(12_345), 123_450_000);
  });

  it('passes through null for absent values', () => {
    assert.equal(centsToAmountMicros(null), null);
    assert.equal(centsToAmountMicros(undefined), null);
    assert.equal(centsToAmountMicros('not a number'), null);
  });
});

describe('tree rollups', () => {
  //        a
  //      /   \
  //     b     c
  //    / \
  //   d   e
  //       |
  //       f
  const tree = [
    { id: 'a', parent_id: null },
    { id: 'b', parent_id: 'a' },
    { id: 'c', parent_id: 'a' },
    { id: 'd', parent_id: 'b' },
    { id: 'e', parent_id: 'b' },
    { id: 'f', parent_id: 'e' },
  ];

  it('counts direct referrals', () => {
    const r = computeTreeRollups(tree);
    assert.equal(r.get('a').directReferralCount, 2);
    assert.equal(r.get('b').directReferralCount, 2);
    assert.equal(r.get('c').directReferralCount, 0);
    assert.equal(r.get('e').directReferralCount, 1);
  });

  it('counts the full downline at any depth', () => {
    const r = computeTreeRollups(tree);
    assert.equal(r.get('a').downlineSize, 5);
    assert.equal(r.get('b').downlineSize, 3);
    assert.equal(r.get('c').downlineSize, 0);
    assert.equal(r.get('e').downlineSize, 1);
    assert.equal(r.get('f').downlineSize, 0);
  });

  it('measures depth with leaves at zero', () => {
    const r = computeTreeRollups(tree);
    assert.equal(r.get('a').treeDepth, 3);
    assert.equal(r.get('b').treeDepth, 2);
    assert.equal(r.get('e').treeDepth, 1);
    assert.equal(r.get('f').treeDepth, 0);
    assert.equal(r.get('c').treeDepth, 0);
  });

  it('handles a forest with several roots', () => {
    const r = computeTreeRollups([
      { id: 'r1', parent_id: null },
      { id: 'r2', parent_id: null },
      { id: 'x', parent_id: 'r1' },
    ]);
    assert.equal(r.get('r1').downlineSize, 1);
    assert.equal(r.get('r2').downlineSize, 0);
  });

  it('treats a dangling parent_id as a root instead of crashing', () => {
    const r = computeTreeRollups([
      { id: 'orphan', parent_id: 'ghost' },
      { id: 'real', parent_id: null },
    ]);
    assert.equal(r.get('orphan').downlineSize, 0);
    assert.equal(r.get('real').downlineSize, 0);
  });

  it('survives a self-parent', () => {
    const r = computeTreeRollups([{ id: 'loop', parent_id: 'loop' }]);
    assert.equal(r.get('loop').directReferralCount, 0);
    assert.equal(r.get('loop').downlineSize, 0);
  });

  it('terminates on a cycle rather than blowing the stack', () => {
    const r = computeTreeRollups([
      { id: 'x', parent_id: 'z' },
      { id: 'y', parent_id: 'x' },
      { id: 'z', parent_id: 'y' },
    ]);
    assert.ok(r.has('x') && r.has('y') && r.has('z'));
  });

  it('coerces numeric ids consistently', () => {
    const r = computeTreeRollups([
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
    ]);
    assert.equal(r.get('1').directReferralCount, 1);
    assert.equal(r.get('2').downlineSize, 0);
  });

  it('handles an empty dataset', () => {
    assert.equal(computeTreeRollups([]).size, 0);
  });
});

describe('genealogy health', () => {
  it('finds cycles', () => {
    const cycles = detectCycles([
      { id: 'x', parent_id: 'z' },
      { id: 'y', parent_id: 'x' },
      { id: 'z', parent_id: 'y' },
      { id: 'clean', parent_id: null },
    ]);
    assert.equal(cycles.has('x'), true);
    assert.equal(cycles.has('y'), true);
    assert.equal(cycles.has('z'), true);
    assert.equal(cycles.has('clean'), false);
  });

  it('reports no cycles for a well-formed tree', () => {
    const cycles = detectCycles([
      { id: 'a', parent_id: null },
      { id: 'b', parent_id: 'a' },
    ]);
    assert.equal(cycles.size, 0);
  });

  it('separates legitimate roots from true orphans and flagged rows', () => {
    const result = findAttentionNeeded([
      { id: 'root', parent_id: null, account_type: 'AMBASSADOR' },
      { id: 'kid', parent_id: 'root', account_type: 'AMBASSADOR' },
      { id: 'lost', parent_id: 'nobody', account_type: 'AMBASSADOR' },
      {
        id: 'review',
        parent_id: 'root',
        account_type: 'CUSTOMER_ONLY',
        needs_sponsor_review: true,
      },
    ]);

    assert.deepEqual(
      result.roots.map((r) => r.id),
      ['root'],
    );
    assert.deepEqual(
      result.orphans.map((r) => r.id),
      ['lost'],
    );
    assert.deepEqual(
      result.flagged.map((r) => r.id),
      ['review'],
    );
  });
});
