'use client';

import { formatCents } from '../lib/display';
import { isGenerationQualified, RANK_LADDER } from '../lib/ranks';
import { type TreeNode } from '../lib/tree';
import { type DataHealth } from '../server/ambassador-tree';

interface RailProps {
  readonly roots: readonly TreeNode[];
  readonly nodeCount: number;
  readonly rankCounts: Readonly<Record<string, number>>;
  readonly attention: readonly TreeNode[];
  readonly cycleIds: readonly string[];
  readonly orphanIds: readonly string[];
  readonly health: DataHealth | null;
  readonly dark: boolean;
  readonly onSelect: (id: string) => void;
  readonly onExpandAll: () => void;
  readonly onCollapseAll: () => void;
  readonly onFit: () => void;
}

const sum = (roots: readonly TreeNode[], pick: (n: TreeNode) => number): number =>
  roots.reduce((total, root) => total + pick(root), 0);

export const Rail = ({
  roots,
  nodeCount,
  rankCounts,
  attention,
  cycleIds,
  orphanIds,
  health,
  dark,
  onSelect,
  onExpandAll,
  onCollapseAll,
  onFit,
}: RailProps) => {
  const networkRetail = sum(roots, (n) => n.subtree.retailCents);
  const networkCv = sum(roots, (n) => n.subtree.cvCents);
  const deepest = roots.reduce((max, r) => Math.max(max, r.subtree.treeDepth), 0);

  return (
    <aside className="rail">
      <header>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          XO Pure · Genealogy
        </p>
        <h1 className="masthead-title">Ambassador Tree</h1>
      </header>

      <section className="rail-block">
        <h2>Network</h2>
        <div>
          <div className="stat-row">
            <span className="stat-label">Ambassadors</span>
            <span className="stat-value figure">{nodeCount.toLocaleString()}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Generations deep</span>
            <span className="stat-value figure">{deepest}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Retail volume</span>
            <span className="stat-value figure">
              {formatCents(networkRetail, { showCents: false })}
            </span>
          </div>
          {/* CV is 50% of retail (§1.2) — both shown, because team and
              generation money is computed on CV, not retail. */}
          <div className="stat-row">
            <span className="stat-label">Commissionable volume</span>
            <span className="stat-value figure">
              {formatCents(networkCv, { showCents: false })}
            </span>
          </div>
        </div>
      </section>

      <section className="rail-block">
        <h2>Rank</h2>
        <div>
          {RANK_LADDER.map((rank) => (
            <div
              key={rank.key}
              className="legend-step"
              data-qualified={isGenerationQualified(rank.key)}
            >
              <span
                className="legend-swatch"
                style={{ background: dark ? rank.colorDark : rank.color }}
              />
              <span>{rank.label}</span>
              <span className="legend-count">{rankCounts[rank.key] ?? 0}</span>
            </div>
          ))}
        </div>
        <p className="legend-note">
          Colour deepens with rank. A dashed outline marks Leader and above —
          the ranks that earn generation commissions.
        </p>
      </section>

      <section className="rail-block">
        <h2>Needs review</h2>
        {attention.length === 0 && cycleIds.length === 0 ? (
          <p className="legend-note">
            No ambassadors are flagged for sponsor review.
          </p>
        ) : (
          <>
            {cycleIds.length > 0 && (
              <div className="notice">
                {cycleIds.length} ambassador{cycleIds.length === 1 ? '' : 's'} sit
                on a sponsor loop. Their parent chain points back at itself — fix
                the sponsor in XO Pure before trusting their rollups.
              </div>
            )}
            {orphanIds.length > 0 && (
              <div className="notice">
                {orphanIds.length} sponsor{orphanIds.length === 1 ? '' : 's'} fall
                outside the loaded depth, so those branches start mid-tree.
              </div>
            )}
            {attention.slice(0, 12).map((node) => (
              <button
                key={node.id}
                className="flag-item"
                onClick={() => onSelect(node.id)}
              >
                {node.name}
              </button>
            ))}
            {attention.length > 12 && (
              <p className="legend-note">
                and {attention.length - 12} more flagged for review.
              </p>
            )}
          </>
        )}
      </section>

      {health && <DataHealthBlock health={health} />}

      <section className="rail-block">
        <h2>View</h2>
        <div className="control-row">
          <button className="btn" onClick={onExpandAll}>
            Expand all
          </button>
          <button className="btn" onClick={onCollapseAll}>
            Collapse
          </button>
          <button className="btn" onClick={onFit}>
            Fit
          </button>
        </div>
        <p className="legend-note">
          Drag to pan, scroll to zoom. Press 0 to fit, Esc to clear a selection.
        </p>
      </section>
    </aside>
  );
};

/**
 * What the sync did not populate. A gap shown as a confident zero is worse
 * than a gap shown as a gap (§2.6), so these are stated plainly.
 */
const DataHealthBlock = ({ health }: { health: DataHealth }) => {
  const issues: string[] = [];

  if (health.ordersMissingDate > 0) {
    issues.push(
      `${health.ordersMissingDate} of ${health.ordersTotal} orders have no order date, ` +
        'so referral activity over time cannot be shown.',
    );
  }

  if (health.ordersUnattributed > 0) {
    issues.push(
      `${health.ordersUnattributed} of ${health.ordersTotal} orders are not linked ` +
        'to any ambassador, so their revenue is missing from the tree.',
    );
  }

  if (health.commissionsMissingPayArea > 0) {
    const n = health.commissionsMissingPayArea;
    issues.push(
      n === 1
        ? '1 commission row has no pay area, so it cannot be attributed to a rail.'
        : `${n} commission rows have no pay area, so they cannot be attributed to a rail.`,
    );
  }

  if (health.ambassadorsBrokenSponsor > 0) {
    issues.push(
      health.ambassadorsBrokenSponsor === 1
        ? '1 ambassador names a sponsor that does not exist.'
        : `${health.ambassadorsBrokenSponsor} ambassadors name a sponsor that does not exist.`,
    );
  }

  if (issues.length === 0) return null;

  return (
    <section className="rail-block">
      <h2>Data gaps</h2>
      {issues.map((issue) => (
        <p key={issue} className="legend-note">
          {issue}
        </p>
      ))}
      <p className="legend-note" style={{ opacity: 0.75 }}>
        These are sync gaps, not tree errors. Fix them in the Supabase → Twenty sync.
      </p>
    </section>
  );
};
