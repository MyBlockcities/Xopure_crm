// Pure comp-plan mapping and genealogy logic.
//
// Everything in this module is side-effect free and dependency free so it can
// be unit tested without a database. See comp-plan.test.mjs.
//
// Authority: COMP_PLAN_LAW.md and
// "# XO Pure CRM Integration — Developer Guide.md" (§1.5, §2.1, §2.6).

export const normalizeSelectValue = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// ─── Rank ladder ────────────────────────────────────────────────────────────
//
// The internal keys are PERMANENT; only display names change. We store the
// internal key as the Twenty SELECT `value` and carry the spec display name as
// the `label`, so a raw key can never reach the UI (LAW §2.1).
//
// ⚠ The key offset is a permanent hazard:
//     internal `promoter` displays as "Leader"
//     internal `leader`   displays as "Executive"

export const RANK_DISPLAY_NAMES = Object.freeze({
  CUSTOMER: 'Customer',
  STARTER: 'Ambassador',
  BUILDER: 'Partner',
  INFLUENCER: 'Influencer',
  PROMOTER: 'Leader',
  LEADER: 'Executive',
  DIRECTOR: 'Director',
  ICON: 'Visionary',
});

/** Ladder order, lowest → highest. Index doubles as the rank's ordinal. */
export const RANK_ORDER = Object.freeze([
  'CUSTOMER',
  'STARTER',
  'BUILDER',
  'INFLUENCER',
  'PROMOTER',
  'LEADER',
  'DIRECTOR',
  'ICON',
]);

/**
 * "Qualified leader" for generation payouts = internal `promoter`+
 * = display "Leader"+ (guide §1.5).
 */
export const GENERATION_QUALIFYING_RANK = 'PROMOTER';

const RANK_ALIASES = Object.freeze({
  // canonical Supabase keys
  CUSTOMER: 'CUSTOMER',
  STARTER: 'STARTER',
  BUILDER: 'BUILDER',
  INFLUENCER: 'INFLUENCER',
  PROMOTER: 'PROMOTER',
  LEADER: 'LEADER',
  DIRECTOR: 'DIRECTOR',
  ICON: 'ICON',
  // legacy / historical variants observed in the data
  L0_CUSTOMER: 'CUSTOMER',
  L1_STARTER: 'STARTER',
  AFFILIATE: 'STARTER',
  ACTIVE_AFFILIATE: 'STARTER',
  L2_BUILDER: 'BUILDER',
  L3_PROMOTER: 'PROMOTER',
  L4_LEADER: 'LEADER',
  L5_DIRECTOR: 'DIRECTOR',
  L6_ICON: 'ICON',
});

export class UnmappedRankError extends Error {
  constructor(rawValue, normalized) {
    super(
      `Unmapped affiliate rank "${rawValue}" (normalized: "${normalized}"). ` +
        `Add it to RANK_ALIASES — never let a rank silently fall back ` +
        `(COMP_PLAN_LAW §2.6).`,
    );
    this.name = 'UnmappedRankError';
    this.rawValue = rawValue;
    this.normalized = normalized;
  }
}

/**
 * Map a Supabase rank value onto the canonical internal key.
 *
 * Throws on an unrecognised value rather than defaulting. The previous
 * implementation defaulted to the starter tier, which silently mis-displayed
 * every `influencer` ambassador (guide §2.6: never silently drop).
 *
 * A null/empty rank is treated as STARTER — that is an absent value, not an
 * unknown one.
 */
export const mapAffiliateRank = (rank) => {
  const normalized = normalizeSelectValue(rank);

  if (!normalized) return 'STARTER';

  const mapped = RANK_ALIASES[normalized];

  if (!mapped) throw new UnmappedRankError(rank, normalized);

  return mapped;
};

/** Display name for an internal rank key. Never render the key itself. */
export const rankDisplayName = (internalKey) => {
  const name = RANK_DISPLAY_NAMES[internalKey];

  if (!name) throw new UnmappedRankError(internalKey, internalKey);

  return name;
};

/** Numeric ladder position, for comparisons like "is this Leader or above?". */
export const rankOrdinal = (internalKey) => {
  const index = RANK_ORDER.indexOf(internalKey);

  if (index === -1) throw new UnmappedRankError(internalKey, internalKey);

  return index;
};

/** True when the rank qualifies for generation payouts (promoter+ / Leader+). */
export const isGenerationQualified = (internalKey) =>
  rankOrdinal(internalKey) >= rankOrdinal(GENERATION_QUALIFYING_RANK);

// ─── Status ─────────────────────────────────────────────────────────────────
//
// Target enum is the xopureAmbassador.status SELECT:
//   APPLIED | APPROVED | ACTIVE | PAUSED | REJECTED
//
// Eligibility gate (guide §1.3): only `approved` affiliates earn; anyone else
// is skipped and the money compresses past them.

const AMBASSADOR_STATUS_ALIASES = Object.freeze({
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  APPLIED: 'APPLIED',
  PENDING: 'APPLIED',
  SUBMITTED: 'APPLIED',
  PAUSED: 'PAUSED',
  SUSPENDED: 'PAUSED',
  INACTIVE: 'PAUSED',
  DORMANT: 'PAUSED',
  REJECTED: 'REJECTED',
  DENIED: 'REJECTED',
  BANNED: 'REJECTED',
  TERMINATED: 'REJECTED',
});

export const mapAmbassadorStatus = (status) => {
  const normalized = normalizeSelectValue(status);

  if (!normalized) return 'APPLIED';

  return AMBASSADOR_STATUS_ALIASES[normalized] ?? 'APPLIED';
};

/**
 * Good Standing gate (guide §1.3.1). Supabase's `approved` is the only status
 * that earns; everything else compresses.
 */
export const isInGoodStanding = (status) =>
  normalizeSelectValue(status) === 'APPROVED';

export const mapAccountType = (accountType) =>
  normalizeSelectValue(accountType) === 'CUSTOMER_ONLY'
    ? 'CUSTOMER_ONLY'
    : 'AMBASSADOR';

// ─── Money ──────────────────────────────────────────────────────────────────

/** Twenty CURRENCY columns store micros; Supabase stores integer cents. */
export const centsToAmountMicros = (cents) => {
  if (cents === null || cents === undefined) return null;

  const numeric = Number(cents);

  if (Number.isNaN(numeric)) return null;

  return Math.round(numeric * 10_000);
};

// ─── Genealogy ──────────────────────────────────────────────────────────────

/**
 * Compute per-node tree rollups from a flat affiliate adjacency list.
 *
 * Input rows need only `id` and `parent_id`.
 *
 * Returns a Map keyed by String(id) with:
 *   directReferralCount — number of immediate children
 *   downlineSize        — total descendants at any depth
 *   treeDepth           — generations below this node (0 = leaf)
 *
 * Defensive against the two things that actually occur in referral data:
 *   - orphans: a parent_id pointing at a row that does not exist
 *   - cycles:  a node that is (transitively) its own ancestor
 *
 * Cycles are broken rather than throwing, so one bad row cannot take down the
 * whole sync. Use `detectCycles` to surface them for a human.
 */
export const computeTreeRollups = (rows) => {
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const childrenByParent = new Map();

  for (const row of rows) {
    const parentId =
      row.parent_id === null || row.parent_id === undefined
        ? null
        : String(row.parent_id);

    // Treat a parent that isn't in the dataset as a root (orphan).
    if (parentId === null || !byId.has(parentId)) continue;

    // A self-parent is always invalid.
    if (parentId === String(row.id)) continue;

    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(String(row.id));
  }

  const rollups = new Map();
  const state = new Map(); // id -> 'visiting' | 'done'

  const visit = (id) => {
    const cached = rollups.get(id);

    if (cached && state.get(id) === 'done') return cached;

    // Cycle: return a zeroed rollup so the walk terminates.
    if (state.get(id) === 'visiting') {
      return { directReferralCount: 0, downlineSize: 0, treeDepth: 0 };
    }

    state.set(id, 'visiting');

    const children = childrenByParent.get(id) ?? [];
    let downlineSize = 0;
    let maxChildDepth = -1;

    for (const childId of children) {
      const child = visit(childId);
      downlineSize += 1 + child.downlineSize;
      maxChildDepth = Math.max(maxChildDepth, child.treeDepth);
    }

    const result = {
      directReferralCount: children.length,
      downlineSize,
      treeDepth: children.length === 0 ? 0 : maxChildDepth + 1,
    };

    rollups.set(id, result);
    state.set(id, 'done');

    return result;
  };

  for (const row of rows) visit(String(row.id));

  return rollups;
};

/**
 * Return the ids of every node that sits on a parent_id cycle.
 * These must be surfaced to a human — a cycle in a genealogy is always a bug.
 */
export const detectCycles = (rows) => {
  const parentOf = new Map(
    rows.map((row) => [
      String(row.id),
      row.parent_id === null || row.parent_id === undefined
        ? null
        : String(row.parent_id),
    ]),
  );

  const onCycle = new Set();
  const state = new Map(); // id -> 'visiting' | 'done'

  for (const startId of parentOf.keys()) {
    const path = [];
    let current = startId;

    while (current !== null && current !== undefined) {
      if (state.get(current) === 'done') break;

      if (state.get(current) === 'visiting') {
        // Found a cycle: everything from `current` onward in `path` is on it.
        const cycleStart = path.indexOf(current);

        if (cycleStart !== -1) {
          for (const id of path.slice(cycleStart)) onCycle.add(id);
        }
        break;
      }

      state.set(current, 'visiting');
      path.push(current);

      const next = parentOf.get(current);
      current = next !== undefined && parentOf.has(next) ? next : null;
    }

    for (const id of path) state.set(id, 'done');
  }

  return onCycle;
};

/**
 * Genealogy roots and rows needing human attribution review (guide §5).
 * A NULL parent on an approved ambassador is a legitimate root — present it as
 * "review", never as "error".
 */
export const findAttentionNeeded = (rows) => {
  const ids = new Set(rows.map((row) => String(row.id)));

  const orphans = [];
  const roots = [];
  const flagged = [];

  for (const row of rows) {
    const parentId =
      row.parent_id === null || row.parent_id === undefined
        ? null
        : String(row.parent_id);

    if (row.needs_sponsor_review === true) flagged.push(row);

    if (parentId === null) {
      if (normalizeSelectValue(row.account_type) === 'AMBASSADOR') {
        roots.push(row);
      }
      continue;
    }

    // parent_id set but pointing nowhere — a real data integrity problem
    if (!ids.has(parentId)) orphans.push(row);
  }

  return { orphans, roots, flagged, cycles: detectCycles(rows) };
};
