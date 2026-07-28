import { type RankKey } from '../lib/ranks';

export const VISUALIZATION_GRAPH_VERSION =
  'xopure.visualization-graph/v1' as const;

export type VisualizationGraphSource = 'twenty' | 'supabase' | 'demo';

export interface VisualizationNodeMetrics {
  readonly paidAsRank: RankKey;
  readonly careerRank: RankKey;
  readonly status: string | null;
  readonly accountType: string | null;
  readonly needsSponsorReview: boolean;
  readonly joinedAt: string | null;
  readonly lastOrderAt: string | null;
  readonly orderCount: number;
  readonly retailCents: number;
  readonly cvCents: number;
  readonly commissionLifetimeCents: number;
  /** Additive v1 fields: older stored v1 graphs remain readable. */
  readonly commissionPaidCents?: number;
  readonly commissionPayableCents?: number;
  readonly commissionHeldCents?: number;
  readonly commissionAccruedGenerationCents?: number;
  readonly activeCustomerCount: number;
  readonly downlineSize: number;
  readonly directReferralCount: number;
  readonly treeDepth: number;
  readonly monthlyActivity: readonly {
    readonly month: string;
    readonly orderCount: number;
    readonly retailCents: number;
  }[];
}

export interface VisualizationNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly order: number;
  readonly label: string;
  readonly kind: 'ambassador';
  readonly metrics: VisualizationNodeMetrics;
  readonly visual: {
    readonly color: string;
    readonly badges: readonly string[];
  };
}

export interface VisualizationGraphV1 {
  readonly schemaVersion: typeof VISUALIZATION_GRAPH_VERSION;
  readonly graphId: string;
  readonly graphType: 'ambassador-genealogy';
  readonly rooted: true;
  readonly source: {
    readonly system: VisualizationGraphSource;
    readonly rootId: string | null;
    readonly revision: string;
  };
  readonly nodes: readonly VisualizationNode[];
}

export interface VisualizationGraphDraft
  extends Omit<VisualizationGraphV1, 'source'> {
  readonly source: Omit<VisualizationGraphV1['source'], 'revision'>;
}
