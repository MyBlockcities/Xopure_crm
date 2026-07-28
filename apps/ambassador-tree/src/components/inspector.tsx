'use client';

import { formatCents, formatRetailAndCv } from '../lib/display';
import { isGenerationQualified, RANKS } from '../lib/ranks';
import { type TreeNode } from '../lib/tree';

interface InspectorProps {
  readonly node: TreeNode;
  readonly lineage: readonly TreeNode[];
  readonly dark: boolean;
  readonly recordUrl: string | null;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
  readonly onReRoot: (id: string) => void;
}

const Row = ({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value: string;
  stacked?: boolean;
}) => (
  <div className="stat-row" data-stacked={stacked}>
    <span className="stat-label">{label}</span>
    <span className="stat-value figure">{value}</span>
  </div>
);

const monthShort = (month: string): string =>
  new Intl.DateTimeFormat('en-US', { month: 'narrow', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

export const Inspector = ({
  node,
  lineage,
  dark,
  recordUrl,
  onSelect,
  onClose,
  onReRoot,
}: InspectorProps) => {
  const rank = RANKS[node.paidAsRank];
  const swatch = dark ? rank.colorDark : rank.color;
  const activity = node.monthlyActivity.slice(-12);
  const peak = Math.max(1, ...activity.map((m) => m.retailCents));
  const financialRail = [
    {
      key: 'paid',
      label: 'Paid',
      value: node.self.commissionPaidCents,
      color: 'var(--financial-paid)',
    },
    {
      key: 'payable',
      label: 'Payable · next Friday',
      value: node.self.commissionPayableCents,
      color: 'var(--financial-payable)',
    },
    {
      key: 'held',
      label: 'Clearing · 7-day hold',
      value: node.self.commissionHeldCents,
      color: 'var(--financial-held)',
    },
    {
      key: 'generation',
      label: 'Generation · monthly',
      value: node.self.commissionAccruedGenerationCents,
      color: 'var(--financial-generation)',
    },
  ] as const;
  const financialTotal = financialRail.reduce((sum, item) => sum + item.value, 0);

  return (
    <aside className="inspector" aria-label={`Details for ${node.name}`}>
      <button className="inspector-close" onClick={onClose} aria-label="Close details">
        ×
      </button>

      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3>{node.name}</h3>
        {/* Display name only — the internal rank key never reaches the UI. */}
        <span
          className="rank-chip"
          style={{ ['--chip-color' as string]: swatch }}
        >
          {rank.label}
          {isGenerationQualified(node.paidAsRank) && ' · earns generation'}
        </span>
        {node.email && (
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{node.email}</span>
        )}
      </header>

      {node.needsSponsorReview && (
        <div className="notice">
          Flagged for sponsor review. Attribution needs a decision in XO Pure
          before this branch&apos;s commissions can be trusted.
        </div>
      )}

      <section className="rail-block">
        <h2>This ambassador</h2>
        <div>
          <Row label="Orders" value={node.self.orderCount.toLocaleString()} />
          <Row
            label="Personal volume"
            value={formatRetailAndCv(node.self.retailCents, node.self.cvCents)}
            stacked
          />
          <Row
            label="Active customers"
            value={node.self.activeCustomerCount.toLocaleString()}
          />
          <Row
            label="Commissions to date"
            value={formatCents(node.self.commissionLifetimeCents)}
          />
        </div>
      </section>

      <section className="rail-block">
        <div className="section-heading-row">
          <h2>Commission rails</h2>
          <span className="data-badge">Live ledger</span>
        </div>
        <div
          className="financial-track"
          role="img"
          aria-label={financialRail
            .map((item) => `${item.label}: ${formatCents(item.value)}`)
            .join('; ')}
        >
          {financialRail.map((item) =>
            item.value > 0 ? (
              <span
                key={item.key}
                style={{
                  background: item.color,
                  width: `${(item.value / Math.max(1, financialTotal)) * 100}%`,
                }}
              />
            ) : null,
          )}
        </div>
        <div className="financial-legend">
          {financialRail.map((item) => (
            <div className="financial-row" key={item.key}>
              <span
                className="financial-dot"
                style={{ background: item.color }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              <strong className="figure">{formatCents(item.value)}</strong>
            </div>
          ))}
        </div>
        <p className="legend-note">
          Weekly payable and clearing exclude generation. Generation remains on
          its monthly rail and pays on the 5th.
        </p>
      </section>

      <section className="rail-block">
        <h2>Downline</h2>
        <div>
          <Row label="Total below" value={node.subtree.downlineSize.toLocaleString()} />
          <Row
            label="Direct referrals"
            value={node.subtree.directReferralCount.toLocaleString()}
          />
          <Row label="Depth below" value={`${node.subtree.treeDepth} generations`} />
          <Row
            label="Downline volume"
            value={formatRetailAndCv(node.subtree.retailCents, node.subtree.cvCents)}
            stacked
          />
        </div>
      </section>

      {activity.length > 0 && (
        <section className="rail-block">
          <h2>Referral activity · 12 months</h2>
          <div className="heat-strip">
            {activity.map((month) => (
              <div
                key={month.month}
                className="heat-cell"
                title={`${month.month}: ${month.orderCount} orders · ${formatCents(
                  month.retailCents,
                  { showCents: false },
                )} retail`}
                style={{
                  // Sequential: one hue, opacity carries magnitude.
                  ['--cell' as string]: `color-mix(in srgb, ${swatch} ${Math.round(
                    12 + (month.retailCents / peak) * 88,
                  )}%, transparent)`,
                }}
              />
            ))}
          </div>
          <div className="heat-axis">
            {activity.map((month) => (
              <span key={month.month}>{monthShort(month.month)}</span>
            ))}
          </div>
        </section>
      )}

      {lineage.length > 1 && (
        <section className="rail-block">
          <h2>Sponsor line</h2>
          <div>
            {lineage.map((ancestor, index) => (
              <button
                key={ancestor.id}
                className="legend-step"
                onClick={() => onSelect(ancestor.id)}
                style={{ gridTemplateColumns: '22px 1fr auto' }}
              >
                <span className="legend-count">{index === 0 ? 'Root' : `G${index}`}</span>
                <span>{ancestor.name}</span>
                <span className="legend-count">
                  {RANKS[ancestor.paidAsRank].label}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="control-row">
        <button className="btn" onClick={() => onReRoot(node.id)}>
          View this subtree
        </button>
        {recordUrl && (
          <a className="deep-link" href={recordUrl} target="_blank" rel="noreferrer">
            Open in CRM
          </a>
        )}
      </div>
    </aside>
  );
};
