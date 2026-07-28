/**
 * Ambassador tree assembly.
 *
 * Pure and dependency free so it can be unit tested without a database and
 * reused by both the server route and the client renderer.
 *
 * Input is the flat row set produced by sql/ambassador-tree.sql.
 */

import { type RankKey, toRankKey } from './ranks';

// ─── Wire format ────────────────────────────────────────────────────────────

export interface MonthlyActivity {
  readonly month: string; // 'YYYY-MM'
  readonly orderCount: number;
  readonly retailCents: number;
}

/** One flat row as returned by the recursive CTE. */
export interface AmbassadorRow {
  readonly id: string;
  readonly parent_id: string | null;
  readonly depth: number | string;
  readonly name: string | null;
  readonly email: string | null;
  readonly status: string | null;
  readonly account_type: string | null;
  readonly paid_as_rank_key: string | null;
  readonly career_rank_key: string | null;
  readonly rank_key: string | null;
  readonly active_customer_count: number | string | null;
  readonly retail_cents: number | string | null;
  readonly cv_cents: number | string | null;
  readonly order_count: number | string | null;
  readonly commission_lifetime_cents: number | string | null;
  readonly commission_paid_cents?: number | string | null;
  readonly commission_payable_cents?: number | string | null;
  readonly commission_held_cents?: number | string | null;
  readonly commission_accrued_generation_cents?: number | string | null;
  readonly needs_sponsor_review: boolean | null;
  readonly joined_at: string | null;
  readonly last_order_at: string | null;
  readonly monthly_activity: readonly MonthlyActivity[] | null;
}

/** Metrics that belong to this ambassador alone. */
export interface SelfMetrics {
  readonly orderCount: number;
  readonly retailCents: number;
  readonly cvCents: number;
  readonly commissionLifetimeCents: number;
  readonly commissionPaidCents: number;
  /** Weekly rail only; generation is kept in commissionAccruedGenerationCents. */
  readonly commissionPayableCents: number;
  /** Weekly clearing rail only; generation is kept separate. */
  readonly commissionHeldCents: number;
  /** Monthly generation rail; never include this in weekly payable. */
  readonly commissionAccruedGenerationCents: number;
  readonly activeCustomerCount: number;
}

/** Metrics summed across this ambassador and every descendant. */
export interface SubtreeMetrics {
  readonly downlineSize: number;
  readonly directReferralCount: number;
  readonly treeDepth: number;
  readonly retailCents: number;
  readonly cvCents: number;
  readonly commissionLifetimeCents: number;
  readonly commissionPaidCents: number;
  readonly commissionPayableCents: number;
  readonly commissionHeldCents: number;
  readonly commissionAccruedGenerationCents: number;
  readonly orderCount: number;
  readonly activeCustomerCount: number;
}

export interface TreeNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly name: string;
  readonly email: string | null;
  readonly status: string | null;
  readonly accountType: string | null;
  /** Canonical internal key. Render via rankLabel(), never directly. */
  readonly paidAsRank: RankKey;
  readonly careerRank: RankKey;
  readonly needsSponsorReview: boolean;
  readonly joinedAt: string | null;
  readonly lastOrderAt: string | null;
  readonly monthlyActivity: readonly MonthlyActivity[];
  readonly self: SelfMetrics;
  readonly subtree: SubtreeMetrics;
  readonly children: TreeNode[];
}

export interface BuildTreeResult {
  readonly roots: TreeNode[];
  /** Rows whose parent_id pointed at a node not present in the result set. */
  readonly orphanIds: readonly string[];
  /** Nodes participating in a parent_id cycle. Always a data bug. */
  readonly cycleIds: readonly string[];
  readonly nodeCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Coerce a driver-supplied numeric to a number.
 *
 * node-postgres returns `bigint`/`numeric` as STRINGS to avoid silent precision
 * loss, so a `SUM(...)::bigint` arrives as "1311300", not 1311300. Rejecting
 * those would zero out every rolled-up money figure — which is exactly the bug
 * this guards against. Anything genuinely non-numeric still becomes 0.
 */
const num = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const displayName = (row: AmbassadorRow): string =>
  row.name?.trim() || row.email?.trim() || `Ambassador ${row.id.slice(0, 8)}`;

/**
 * Detect every node that sits on a parent_id cycle.
 * Exported so callers can surface cycles to a human rather than hide them.
 */
export const findCycleIds = (rows: readonly AmbassadorRow[]): string[] => {
  const parentOf = new Map<string, string | null>(
    rows.map((row) => [row.id, row.parent_id]),
  );

  const onCycle = new Set<string>();
  const settled = new Set<string>();

  for (const startId of parentOf.keys()) {
    if (settled.has(startId)) continue;

    const path: string[] = [];
    const seen = new Set<string>();
    let current: string | null | undefined = startId;

    while (current != null && !settled.has(current)) {
      if (seen.has(current)) {
        for (const id of path.slice(path.indexOf(current))) onCycle.add(id);
        break;
      }

      seen.add(current);
      path.push(current);

      const next = parentOf.get(current);
      current = next != null && parentOf.has(next) ? next : null;
    }

    for (const id of path) settled.add(id);
  }

  return [...onCycle];
};

// ─── Build ──────────────────────────────────────────────────────────────────

/**
 * Stratify flat rows into a nested forest, computing subtree rollups bottom-up.
 *
 * Defensive against the two things that actually occur in referral data:
 *   - a parent_id pointing at a row outside the result set (treated as a root
 *     and reported in `orphanIds` — this is expected when lazy loading a
 *     bounded depth, and a genuine bug when loading the whole forest)
 *   - parent_id cycles (broken, and reported in `cycleIds`)
 */
export const buildTree = (rows: readonly AmbassadorRow[]): BuildTreeResult => {
  const cycleIds = findCycleIds(rows);
  const onCycle = new Set(cycleIds);

  const nodes = new Map<string, TreeNode>();

  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      depth: num(row.depth),
      name: displayName(row),
      email: row.email,
      status: row.status,
      accountType: row.account_type,
      paidAsRank: toRankKey(
        row.paid_as_rank_key ?? row.career_rank_key ?? row.rank_key,
      ),
      careerRank: toRankKey(row.career_rank_key ?? row.rank_key),
      needsSponsorReview: row.needs_sponsor_review === true,
      joinedAt: row.joined_at,
      lastOrderAt: row.last_order_at,
      monthlyActivity: row.monthly_activity ?? [],
      self: {
        orderCount: num(row.order_count),
        retailCents: num(row.retail_cents),
        cvCents: num(row.cv_cents),
        commissionLifetimeCents: num(row.commission_lifetime_cents),
        commissionPaidCents: num(row.commission_paid_cents),
        commissionPayableCents: num(row.commission_payable_cents),
        commissionHeldCents: num(row.commission_held_cents),
        commissionAccruedGenerationCents: num(
          row.commission_accrued_generation_cents,
        ),
        activeCustomerCount: num(row.active_customer_count),
      },
      // Placeholder; replaced by the bottom-up pass below.
      subtree: {
        downlineSize: 0,
        directReferralCount: 0,
        treeDepth: 0,
        retailCents: 0,
        cvCents: 0,
        commissionLifetimeCents: 0,
        commissionPaidCents: 0,
        commissionPayableCents: 0,
        commissionHeldCents: 0,
        commissionAccruedGenerationCents: 0,
        orderCount: 0,
        activeCustomerCount: 0,
      },
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  const orphanIds: string[] = [];

  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;

    const parentId = row.parent_id;

    // A cycle member is re-rooted so the structure stays a forest.
    if (parentId == null || onCycle.has(row.id)) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(parentId);

    if (!parent) {
      orphanIds.push(row.id);
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  // Bottom-up rollup, iterative to avoid blowing the stack on a deep chain.
  const order: TreeNode[] = [];
  const stack = [...roots];

  while (stack.length > 0) {
    const node = stack.pop() as TreeNode;
    order.push(node);
    for (const child of node.children) stack.push(child);
  }

  for (let i = order.length - 1; i >= 0; i -= 1) {
    const node = order[i];

    let downlineSize = 0;
    let treeDepth = 0;
    let retailCents = node.self.retailCents;
    let cvCents = node.self.cvCents;
    let commissionLifetimeCents = node.self.commissionLifetimeCents;
    let commissionPaidCents = node.self.commissionPaidCents;
    let commissionPayableCents = node.self.commissionPayableCents;
    let commissionHeldCents = node.self.commissionHeldCents;
    let commissionAccruedGenerationCents =
      node.self.commissionAccruedGenerationCents;
    let orderCount = node.self.orderCount;
    let activeCustomerCount = node.self.activeCustomerCount;

    for (const child of node.children) {
      downlineSize += 1 + child.subtree.downlineSize;
      treeDepth = Math.max(treeDepth, child.subtree.treeDepth + 1);
      retailCents += child.subtree.retailCents;
      cvCents += child.subtree.cvCents;
      commissionLifetimeCents += child.subtree.commissionLifetimeCents;
      commissionPaidCents += child.subtree.commissionPaidCents;
      commissionPayableCents += child.subtree.commissionPayableCents;
      commissionHeldCents += child.subtree.commissionHeldCents;
      commissionAccruedGenerationCents +=
        child.subtree.commissionAccruedGenerationCents;
      orderCount += child.subtree.orderCount;
      activeCustomerCount += child.subtree.activeCustomerCount;
    }

    (node as { subtree: SubtreeMetrics }).subtree = {
      downlineSize,
      directReferralCount: node.children.length,
      treeDepth,
      retailCents,
      cvCents,
      commissionLifetimeCents,
      commissionPaidCents,
      commissionPayableCents,
      commissionHeldCents,
      commissionAccruedGenerationCents,
      orderCount,
      activeCustomerCount,
    };
  }

  return {
    roots,
    orphanIds,
    cycleIds,
    nodeCount: nodes.size,
  };
};

// ─── Navigation ─────────────────────────────────────────────────────────────

/** Depth-first walk. */
export function* walk(node: TreeNode): Generator<TreeNode> {
  yield node;
  for (const child of node.children) yield* walk(child);
}

/** Re-root the visualization on a node (Phase 5: "view this subtree"). */
export const findNode = (
  roots: readonly TreeNode[],
  id: string,
): TreeNode | null => {
  for (const root of roots) {
    for (const node of walk(root)) {
      if (node.id === id) return node;
    }
  }

  return null;
};

/**
 * Lineage from the selected node back to its root, root-first.
 * This is the path that gets the reserved accent colour (Phase 9).
 */
export const lineageOf = (
  roots: readonly TreeNode[],
  id: string,
): TreeNode[] => {
  const byId = new Map<string, TreeNode>();

  for (const root of roots) {
    for (const node of walk(root)) byId.set(node.id, node);
  }

  const lineage: TreeNode[] = [];
  const seen = new Set<string>();
  let current = byId.get(id) ?? null;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    lineage.unshift(current);
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }

  return lineage;
};

/** Flatten to a list, for virtualized/accordion rendering on narrow viewports. */
export const flatten = (roots: readonly TreeNode[]): TreeNode[] => {
  const out: TreeNode[] = [];
  for (const root of roots) {
    for (const node of walk(root)) out.push(node);
  }

  return out;
};

/** Top performers by subtree revenue — powers the "highest leverage" view. */
export const topByDownlineRevenue = (
  roots: readonly TreeNode[],
  limit = 10,
): TreeNode[] =>
  flatten(roots)
    .slice()
    .sort((a, b) => b.subtree.retailCents - a.subtree.retailCents)
    .slice(0, limit);
