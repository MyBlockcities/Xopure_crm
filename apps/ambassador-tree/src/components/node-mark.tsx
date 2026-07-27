'use client';

import { memo } from 'react';

import { formatCents } from '../lib/display';
import { type LayoutNode } from '../lib/layout';
import { isGenerationQualified, RANKS } from '../lib/ranks';
import { CARD_HEIGHT, CARD_WIDTH, cardRect } from './geometry';

interface NodeMarkProps {
  readonly item: LayoutNode;
  readonly selected: boolean;
  readonly onLineage: boolean;
  readonly dimmed: boolean;
  readonly dark: boolean;
  readonly onSelect: (id: string) => void;
  readonly onToggle: (id: string) => void;
}

/** Truncate to fit the card rather than letting the label overrun it. */
const fit = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const NodeMarkComponent = ({
  item,
  selected,
  onLineage,
  dimmed,
  dark,
  onSelect,
  onToggle,
}: NodeMarkProps) => {
  const { node, x, y, collapsed, hiddenDescendants } = item;
  const rect = cardRect(x, y);
  const rank = RANKS[node.paidAsRank];
  const swatch = dark ? rank.colorDark : rank.color;
  const qualified = isGenerationQualified(node.paidAsRank);
  const hasChildren = node.children.length > 0;

  return (
    <g
      className="node"
      data-selected={selected}
      data-lineage={onLineage}
      data-dimmed={dimmed}
      tabIndex={0}
      role="button"
      aria-label={`${node.name}, ${rank.label}, ${node.subtree.downlineSize} in downline`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(node.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(node.id);
        }

        if (event.key === 'ArrowRight' && hasChildren) onToggle(node.id);
        if (event.key === 'ArrowLeft' && hasChildren) onToggle(node.id);
      }}
    >
      <rect className="node-card" rx={3} {...rect} />

      {/* Rank as a sequential swatch. The label beside it carries identity —
          the ramp is never the only encoding (LAW §2.1). */}
      <rect
        className="rank-bar"
        x={rect.x}
        y={rect.y}
        width={4}
        height={CARD_HEIGHT}
        rx={1}
        fill={swatch}
      />

      {/* Generation-qualified (internal promoter+ = display Leader+) is a
          threshold, not a magnitude — so it gets its own mark. */}
      {qualified && (
        <rect
          className="rank-ring"
          x={rect.x + 1.5}
          y={rect.y + 1.5}
          width={CARD_WIDTH - 3}
          height={CARD_HEIGHT - 3}
          rx={2}
          strokeDasharray="3 3"
        />
      )}

      <text className="node-name" x={rect.x + 13} y={y - 4}>
        {fit(node.name, 20)}
      </text>

      <text className="node-rank" x={rect.x + 13} y={y + 11}>
        {rank.label}
      </text>

      <text className="node-figure" x={rect.x + CARD_WIDTH - 10} y={y + 11} textAnchor="end">
        {formatCents(node.subtree.retailCents, { showCents: false })}
      </text>

      {node.needsSponsorReview && (
        <circle className="flag-dot" cx={rect.x + CARD_WIDTH - 8} cy={rect.y + 8} r={3.5}>
          <title>Flagged for sponsor review</title>
        </circle>
      )}

      {hasChildren && (
        <g
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
          role="button"
          aria-label={
            collapsed
              ? `Expand ${hiddenDescendants} hidden below ${node.name}`
              : `Collapse ${node.subtree.downlineSize} below ${node.name}`
          }
        >
          <circle
            className="toggle"
            cx={rect.x + CARD_WIDTH}
            cy={y}
            r={collapsed ? 12 : 8}
          />
          <text
            className="toggle-label"
            x={rect.x + CARD_WIDTH}
            y={y + 3.2}
            textAnchor="middle"
          >
            {collapsed ? hiddenDescendants : '−'}
          </text>
        </g>
      )}
    </g>
  );
};

export const NodeMark = memo(NodeMarkComponent);
