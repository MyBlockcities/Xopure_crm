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
  readonly layoutMode: 'genealogy' | 'radial';
  readonly onLayoutMode: (mode: 'genealogy' | 'radial') => void;
  readonly exportsEnabled: boolean;
  readonly exportRootId: string | null;
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
  layoutMode,
  onLayoutMode,
  exportsEnabled,
  exportRootId,
  onSelect,
  onExpandAll,
  onCollapseAll,
  onFit,
}: RailProps) => {
  const networkRetail = sum(roots, (n) => n.subtree.retailCents);
  const networkCv = sum(roots, (n) => n.subtree.cvCents);
  const networkPayable = sum(
    roots,
    (n) => n.subtree.commissionPayableCents,
  );
  const networkHeld = sum(roots, (n) => n.subtree.commissionHeldCents);
  const networkGeneration = sum(
    roots,
    (n) => n.subtree.commissionAccruedGenerationCents,
  );
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
        <h2>Commission rails</h2>
        <div>
          <div className="stat-row">
            <span className="stat-label">Payable · weekly</span>
            <span className="stat-value figure">{formatCents(networkPayable)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Clearing · weekly</span>
            <span className="stat-value figure">{formatCents(networkHeld)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Generation · monthly</span>
            <span className="stat-value figure">
              {formatCents(networkGeneration)}
            </span>
          </div>
        </div>
        <p className="legend-note">
          Current ledger state. Monthly generation is never mixed into weekly
          payable.
        </p>
      </section>

      <section className="rail-block">
        <h2>View</h2>
        <div className="segmented-control" aria-label="Tree layout">
          <button
            className="btn"
            aria-pressed={layoutMode === 'genealogy'}
            onClick={() => onLayoutMode('genealogy')}
          >
            Genealogy
          </button>
          <button
            className="btn"
            aria-pressed={layoutMode === 'radial'}
            onClick={() => onLayoutMode('radial')}
          >
            Radial
          </button>
        </div>
        <div className="control-row">
          <button className="btn" onClick={onExpandAll}>
            Expand all
          </button>
          <button className="btn" onClick={onCollapseAll}>
            Collapse
          </button>
          {layoutMode === 'genealogy' ? (
            <button className="btn" onClick={onFit}>
              Fit
            </button>
          ) : null}
        </div>
        <p className="legend-note">
          {layoutMode === 'genealogy'
            ? 'Drag to pan, scroll to zoom. Press 0 to fit, Esc to clear a selection.'
            : 'Colour shows rank, node size shows downline, green rings show recent activity, and orange rings flag review.'}
        </p>
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
            {attention.slice(0, 8).map((node) => (
              <button
                key={node.id}
                className="flag-item"
                onClick={() => onSelect(node.id)}
              >
                {node.name}
              </button>
            ))}
            {attention.length > 8 && (
              <p className="legend-note">
                and {attention.length - 8} more flagged for review.
              </p>
            )}
          </>
        )}
      </section>

      {health && <DataHealthBlock health={health} />}

      {exportsEnabled ? (
        <details className="rail-block export-disclosure">
          <summary>Export &amp; interoperability</summary>
          <div className="export-grid">
            {[
              ['svg', 'SVG'],
              ['json', 'JSON'],
              ['newick', 'Newick'],
              ['nexus', 'Nexus'],
              ['phyloxml', 'PhyloXML'],
              ['itol-zip', 'iTOL ZIP'],
            ].map(([format, label]) => {
              const query = new URLSearchParams({ format });
              if (exportRootId) query.set('rootId', exportRootId);

              return (
                <a
                  key={format}
                  className="btn export-link"
                  href={`/api/tree-export?${query.toString()}`}
                  download
                >
                  {label}
                </a>
              );
            })}
          </div>
          <p className="legend-note">
            Generated from the current read-only genealogy. Presentation exports
            exclude email and are not stored.
          </p>
        </details>
      ) : null}
    </aside>
  );
};

/**
 * What the sync did not populate. A gap shown as a confident zero is worse
 * than a gap shown as a gap (§2.6), so these are stated plainly.
 */
const DataHealthBlock = ({ health }: { health: DataHealth }) => {
  const issues: string[] = [];
  const orderCoverage =
    health.ordersTotal === 0
      ? 100
      : ((health.ordersTotal - health.ordersUnattributed) /
          health.ordersTotal) *
        100;
  const commissionCoverage =
    health.commissionsTotal === 0
      ? 100
      : ((health.commissionsTotal - health.commissionsMissingPayArea) /
          health.commissionsTotal) *
        100;
  const timelineCoverage =
    health.ordersTotal === 0
      ? 100
      : ((health.ordersTotal - health.ordersMissingDate) / health.ordersTotal) *
        100;

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

  if (!health.commissionTimelineAvailable) {
    issues.push(
      'Week-by-week payout history is withheld until source earning timestamps are synchronized into Twenty.',
    );
  }

  return (
    <section className="rail-block">
      <div className="section-heading-row">
        <h2>Data confidence</h2>
        <span
          className="data-badge"
          data-state={issues.length === 0 ? 'complete' : 'partial'}
        >
          {issues.length === 0 ? 'Complete' : 'Partial'}
        </span>
      </div>
      <CoverageBar label="Order attribution" percent={orderCoverage} />
      <CoverageBar label="Commission classification" percent={commissionCoverage} />
      <CoverageBar label="Order timeline" percent={timelineCoverage} />
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

const CoverageBar = ({
  label,
  percent,
}: {
  readonly label: string;
  readonly percent: number;
}) => {
  const bounded = Math.max(0, Math.min(100, percent));

  return (
    <div className="coverage">
      <div className="coverage-label">
        <span>{label}</span>
        <span className="figure">{bounded.toFixed(bounded === 100 ? 0 : 1)}%</span>
      </div>
      <div
        className="coverage-track"
        role="img"
        aria-label={`${label}: ${bounded.toFixed(1)}%`}
      >
        <span style={{ width: `${bounded}%` }} />
      </div>
    </div>
  );
};
