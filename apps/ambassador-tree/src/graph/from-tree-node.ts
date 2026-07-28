import { type RankKey, RANKS } from '../lib/ranks';
import { type TreeNode } from '../lib/tree';
import { sha256 } from './revision';
import {
  VISUALIZATION_GRAPH_VERSION,
  type VisualizationGraphSource,
  type VisualizationGraphV1,
  type VisualizationNode,
} from './visualization-graph';
import { assertValidVisualizationGraph } from './validate';

const badgesFor = (node: TreeNode): string[] => {
  const badges: string[] = [];
  if (node.needsSponsorReview) badges.push('sponsor-review');
  if (node.status?.toLowerCase() === 'pending') badges.push('pending');

  return badges;
};

const nodeColor = (rank: RankKey): string => RANKS[rank].color;

const exportLabel = (node: TreeNode): string => {
  const email = node.email?.trim().toLowerCase();
  if (email && node.name.trim().toLowerCase() === email) {
    return `Ambassador ${node.id.slice(0, 8)}`;
  }

  return node.name;
};

export interface FromTreeOptions {
  readonly graphId?: string;
  readonly rootId?: string | null;
  readonly source: VisualizationGraphSource;
}

export const visualizationGraphFromRoots = async (
  roots: readonly TreeNode[],
  options: FromTreeOptions,
): Promise<VisualizationGraphV1> => {
  const nodes: VisualizationNode[] = [];
  const stack = [...roots]
    .reverse()
    .map((node, order) => ({ node, parentId: null as string | null, order }));

  while (stack.length > 0) {
    const { node, parentId, order } = stack.pop()!;
    nodes.push({
      id: node.id,
      parentId,
      order,
      label: exportLabel(node),
      kind: 'ambassador',
      metrics: {
        paidAsRank: node.paidAsRank,
        careerRank: node.careerRank,
        status: node.status,
        accountType: node.accountType,
        needsSponsorReview: node.needsSponsorReview,
        joinedAt: node.joinedAt,
        lastOrderAt: node.lastOrderAt,
        orderCount: node.self.orderCount,
        retailCents: node.self.retailCents,
        cvCents: node.self.cvCents,
        commissionLifetimeCents: node.self.commissionLifetimeCents,
        commissionPaidCents: node.self.commissionPaidCents,
        commissionPayableCents: node.self.commissionPayableCents,
        commissionHeldCents: node.self.commissionHeldCents,
        commissionAccruedGenerationCents:
          node.self.commissionAccruedGenerationCents,
        activeCustomerCount: node.self.activeCustomerCount,
        downlineSize: node.subtree.downlineSize,
        directReferralCount: node.subtree.directReferralCount,
        treeDepth: node.subtree.treeDepth,
        monthlyActivity: node.monthlyActivity,
      },
      visual: {
        color: nodeColor(node.paidAsRank),
        badges: badgesFor(node),
      },
    });

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push({
        node: node.children[index]!,
        parentId: node.id,
        order: index,
      });
    }
  }

  /*
   * The renderer supports a forest, while interchange formats conventionally
   * want one root. Add a deterministic synthetic root only at this adapter
   * boundary; the business records are never changed.
   */
  if (roots.length > 1) {
    const syntheticId = `${options.graphId ?? 'ambassador-network'}:root`;
    for (const node of nodes) {
      if (node.parentId === null) {
        (node as { parentId: string | null }).parentId = syntheticId;
      }
    }
    nodes.unshift({
      id: syntheticId,
      parentId: null,
      order: 0,
      label: 'XO Pure Ambassador Network',
      kind: 'ambassador',
      metrics: {
        paidAsRank: 'starter',
        careerRank: 'starter',
        status: null,
        accountType: null,
        needsSponsorReview: false,
        joinedAt: null,
        lastOrderAt: null,
        orderCount: 0,
        retailCents: 0,
        cvCents: 0,
        commissionLifetimeCents: 0,
        commissionPaidCents: 0,
        commissionPayableCents: 0,
        commissionHeldCents: 0,
        commissionAccruedGenerationCents: 0,
        activeCustomerCount: 0,
        downlineSize: nodes.length,
        directReferralCount: roots.length,
        treeDepth: Math.max(0, ...roots.map((root) => root.subtree.treeDepth + 1)),
        monthlyActivity: [],
      },
      visual: { color: '#0b4f6c', badges: ['synthetic-root'] },
    });
  }

  const graphWithoutRevision = {
    schemaVersion: VISUALIZATION_GRAPH_VERSION,
    graphId: options.graphId ?? 'ambassador-network',
    graphType: 'ambassador-genealogy' as const,
    rooted: true as const,
    source: {
      system: options.source,
      rootId: options.rootId ?? null,
    },
    nodes,
  };
  const revision = await sha256(graphWithoutRevision);
  const graph: VisualizationGraphV1 = {
    ...graphWithoutRevision,
    source: { ...graphWithoutRevision.source, revision },
  };

  assertValidVisualizationGraph(graph);

  return graph;
};
