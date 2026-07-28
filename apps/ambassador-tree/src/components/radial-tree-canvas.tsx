'use client';

import { useMemo } from 'react';

import { formatCents } from '../lib/display';
import { layoutRadialTree } from '../lib/radial-layout';
import { RANKS } from '../lib/ranks';
import { type TreeNode } from '../lib/tree';

interface RadialTreeCanvasProps {
  readonly roots: readonly TreeNode[];
  readonly collapsed: ReadonlySet<string>;
  readonly selectedId: string | null;
  readonly lineageIds: ReadonlySet<string>;
  readonly dark: boolean;
  readonly onSelect: (id: string | null) => void;
  readonly onToggle: (id: string) => void;
  /** Width occupied by the inspector on the right. */
  readonly obscuredRight: number;
}

const VIEW_RADIUS = 630;
const SYNTHETIC_ROOT_ID = 'xopure-radial-root';

const syntheticRoot = (roots: readonly TreeNode[]): TreeNode => ({
  id: SYNTHETIC_ROOT_ID,
  parentId: null,
  depth: 0,
  name: 'XO Pure Ambassador Network',
  email: null,
  status: null,
  accountType: null,
  paidAsRank: 'starter',
  careerRank: 'starter',
  needsSponsorReview: false,
  joinedAt: null,
  lastOrderAt: null,
  monthlyActivity: [],
  self: {
    orderCount: 0,
    retailCents: 0,
    cvCents: 0,
    commissionLifetimeCents: 0,
    commissionPaidCents: 0,
    commissionPayableCents: 0,
    commissionHeldCents: 0,
    commissionAccruedGenerationCents: 0,
    activeCustomerCount: 0,
  },
  subtree: {
    downlineSize: roots.reduce(
      (total, root) => total + root.subtree.downlineSize + 1,
      0,
    ),
    directReferralCount: roots.length,
    treeDepth: Math.max(0, ...roots.map((root) => root.subtree.treeDepth + 1)),
    retailCents: roots.reduce((total, root) => total + root.subtree.retailCents, 0),
    cvCents: roots.reduce((total, root) => total + root.subtree.cvCents, 0),
    commissionLifetimeCents: roots.reduce(
      (total, root) => total + root.subtree.commissionLifetimeCents,
      0,
    ),
    commissionPaidCents: roots.reduce(
      (total, root) => total + root.subtree.commissionPaidCents,
      0,
    ),
    commissionPayableCents: roots.reduce(
      (total, root) => total + root.subtree.commissionPayableCents,
      0,
    ),
    commissionHeldCents: roots.reduce(
      (total, root) => total + root.subtree.commissionHeldCents,
      0,
    ),
    commissionAccruedGenerationCents: roots.reduce(
      (total, root) =>
        total + root.subtree.commissionAccruedGenerationCents,
      0,
    ),
    orderCount: roots.reduce((total, root) => total + root.subtree.orderCount, 0),
    activeCustomerCount: roots.reduce(
      (total, root) => total + root.subtree.activeCustomerCount,
      0,
    ),
  },
  children: [...roots],
});

export const RadialTreeCanvas = ({
  roots,
  collapsed,
  selectedId,
  lineageIds,
  dark,
  onSelect,
  onToggle,
  obscuredRight,
}: RadialTreeCanvasProps) => {
  const root = useMemo(
    () => (roots.length === 1 ? roots[0]! : roots.length > 1 ? syntheticRoot(roots) : null),
    [roots],
  );
  const layout = useMemo(
    () => (root ? layoutRadialTree(root, collapsed, 500) : null),
    [root, collapsed],
  );

  if (!layout) return null;

  const hasSelection = selectedId !== null;
  const hasSyntheticRoot = root?.id === SYNTHETIC_ROOT_ID;
  const generationOffset = hasSyntheticRoot ? 1 : 0;
  const generations = new Map<number, number>();

  for (const item of layout.nodes) {
    if (item.node.id === SYNTHETIC_ROOT_ID) continue;
    const generation = item.depth - generationOffset;
    const existing = generations.get(generation);
    if (existing === undefined || item.radius < existing) {
      generations.set(generation, item.radius);
    }
  }
  const generationRings = [...generations.entries()]
    .filter(([, radius]) => radius > 0)
    .sort(([a], [b]) => a - b);

  return (
    <div
      className="canvas-wrap radial-wrap"
      style={{
        width: `calc(100% - ${obscuredRight}px)`,
      }}
    >
      <svg
        className="tree-svg radial-svg"
        role="tree"
        aria-label="Radial ambassador genealogy"
        viewBox={`${-VIEW_RADIUS} ${-VIEW_RADIUS} ${VIEW_RADIUS * 2} ${VIEW_RADIUS * 2}`}
        onClick={() => onSelect(null)}
      >
        <defs>
          <radialGradient id="radial-water-glow">
            <stop offset="0%" stopColor="var(--beam)" stopOpacity="0.12" />
            <stop offset="55%" stopColor="var(--beam)" stopOpacity="0.035" />
            <stop offset="100%" stopColor="var(--beam)" stopOpacity="0" />
          </radialGradient>
          <filter id="radial-selected-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g>
          <circle className="radial-atmosphere" r={570} />
          {generationRings.map(([generation, radius]) => (
            <g key={generation}>
              <circle className="radial-generation" r={radius} />
              <text className="radial-generation-label" x={10} y={-radius + 15}>
                G{generation}
              </text>
            </g>
          ))}
          {hasSyntheticRoot ? (
            <g className="radial-hub" aria-hidden="true">
              <circle r={27} />
              <circle r={20} />
              <text y={3}>XO</text>
            </g>
          ) : null}

          {layout.links.map((link) => {
            const onLineage =
              lineageIds.has(link.sourceId) && lineageIds.has(link.targetId);

            return (
              <path
                key={link.id}
                className="link radial-link"
                d={link.path}
                data-lineage={onLineage}
                data-dimmed={hasSelection && !onLineage}
              />
            );
          })}

          {layout.nodes.map((item) => {
            if (item.node.id === SYNTHETIC_ROOT_ID) return null;
            const rank = RANKS[item.node.paidAsRank];
            const onLineage = lineageIds.has(item.node.id);
            const isSelected = item.node.id === selectedId;
            const flip = item.angle > Math.PI;
            const labelX = item.x + (flip ? -12 : 12);
            const labelAnchor = flip ? 'end' : 'start';
            const nodeRadius = Math.min(
              12,
              5 + Math.log2(item.node.subtree.downlineSize + 1),
            );
            const recentOrders =
              item.node.monthlyActivity[item.node.monthlyActivity.length - 1]
                ?.orderCount ?? 0;
            const activityOpacity = Math.min(0.95, 0.18 + recentOrders / 12);

            return (
              <g
                key={item.node.id}
                className="radial-node"
                role="treeitem"
                aria-label={`${item.node.name}, ${rank.label}, ${formatCents(item.node.self.retailCents)}`}
                aria-selected={isSelected}
                data-dimmed={hasSelection && !onLineage && !isSelected}
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(item.node.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (item.node.children.length > 0) onToggle(item.node.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(item.node.id);
                  }
                }}
              >
                {item.node.needsSponsorReview ? (
                  <circle className="radial-review-ring" cx={item.x} cy={item.y} r={nodeRadius + 5} />
                ) : null}
                {recentOrders > 0 ? (
                  <circle
                    className="radial-activity-ring"
                    cx={item.x}
                    cy={item.y}
                    r={nodeRadius + 3}
                    opacity={activityOpacity}
                  />
                ) : null}
                <circle
                  className="radial-node-mark"
                  cx={item.x}
                  cy={item.y}
                  r={nodeRadius}
                  fill={dark ? rank.colorDark : rank.color}
                  data-selected={isSelected}
                  data-qualified={rank.ordinal >= RANKS.promoter.ordinal}
                  style={{
                    filter: isSelected ? 'url(#radial-selected-glow)' : undefined,
                  }}
                />
                <title>
                  {`${item.node.name} · ${rank.label} · ${recentOrders} recent order${recentOrders === 1 ? '' : 's'} · ${item.node.subtree.downlineSize} downline`}
                </title>
                <text
                  className="radial-node-label"
                  x={labelX}
                  y={item.y + 4}
                  textAnchor={labelAnchor}
                >
                  {item.node.name}
                  {item.collapsed ? ` (+${item.hiddenDescendants})` : ''}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="radial-help">
        Select a node for details · double-click a branch to collapse
      </div>
    </div>
  );
};
