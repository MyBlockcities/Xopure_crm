'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { collapseBeyondDepth, expandToNode } from '../lib/layout';
import { type RankKey, RANK_KEYS } from '../lib/ranks';
import { findNode, flatten, lineageOf, type TreeNode } from '../lib/tree';
import { type TreePayload } from '../server/ambassador-tree';
import { Inspector } from './inspector';
import { Rail } from './rail';
import { TreeCanvas } from './tree-canvas';

interface TreeExplorerProps {
  readonly payload: TreePayload;
  /** Twenty base URL, for record deep links. */
  readonly crmBaseUrl: string | null;
}

/** Generations visible before the tree folds — three reads without scrolling. */
const INITIAL_VISIBLE_DEPTH = 2;

/** Must match --inspector in globals.css. */
const INSPECTOR_WIDTH = 340;

export const TreeExplorer = ({ payload, crmBaseUrl }: TreeExplorerProps) => {
  const [reRootId, setReRootId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [dark, setDark] = useState(false);

  // Follow the host's colour scheme so the embed matches Twenty.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      setDark(query.matches);
      document.documentElement.dataset.theme = query.matches ? 'dark' : 'light';
    };

    apply();
    query.addEventListener('change', apply);

    return () => query.removeEventListener('change', apply);
  }, []);

  // Re-rooting shows one ambassador's subtree without another query.
  // Biggest downline first, so the main genealogy leads and stray
  // single-person roots do not push it off screen.
  const orderedRoots = useMemo(
    () =>
      [...payload.roots].sort(
        (a, b) => b.subtree.downlineSize - a.subtree.downlineSize,
      ),
    [payload.roots],
  );

  const roots = useMemo(() => {
    if (!reRootId) return orderedRoots;
    const found = findNode(orderedRoots, reRootId);

    return found ? [found] : orderedRoots;
  }, [orderedRoots, reRootId]);

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() =>
    collapseBeyondDepth(payload.roots, INITIAL_VISIBLE_DEPTH),
  );


  useEffect(() => {
    setCollapsed(collapseBeyondDepth(roots, INITIAL_VISIBLE_DEPTH));
    setFitToken((token) => token + 1);
  }, [roots]);

  const allNodes = useMemo(() => flatten(roots), [roots]);

  const rankCounts = useMemo(() => {
    const counts = Object.fromEntries(RANK_KEYS.map((key) => [key, 0])) as Record<
      RankKey,
      number
    >;

    for (const node of allNodes) counts[node.paidAsRank] += 1;

    return counts;
  }, [allNodes]);

  // Guide §5: flagged and orphaned ambassadors are surfaced, never dropped.
  const attention = useMemo(
    () => allNodes.filter((node) => node.needsSponsorReview),
    [allNodes],
  );

  const selected = useMemo(
    () => (selectedId ? findNode(roots, selectedId) : null),
    [roots, selectedId],
  );

  const lineage = useMemo(
    () => (selectedId ? lineageOf(roots, selectedId) : []),
    [roots, selectedId],
  );

  const lineageIds = useMemo(
    () => new Set(lineage.map((node) => node.id)),
    [lineage],
  );

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      // Selecting from the rail must reveal the node, not just highlight it.
      if (id) setCollapsed((current) => expandToNode(roots, id, current));
    },
    [roots],
  );

  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setCollapsed(new Set());
    setFitToken((token) => token + 1);
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsed(collapseBeyondDepth(roots, 1));
    setFitToken((token) => token + 1);
  }, [roots]);

  const recordUrl = (node: TreeNode | null): string | null =>
    node && crmBaseUrl ? `${crmBaseUrl.replace(/\/$/, '')}/object/xopureAmbassador/${node.id}` : null;

  return (
    <div className="shell">
      <Rail
        roots={roots}
        nodeCount={allNodes.length}
        rankCounts={rankCounts}
        attention={attention}
        cycleIds={payload.cycleIds}
        orphanIds={payload.orphanIds}
        health={payload.health}
        dark={dark}
        onSelect={select}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onFit={() => setFitToken((token) => token + 1)}
      />

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {payload.source === 'demo' && (
          <div className="demo-banner">
            Demo data — not the live network
          </div>
        )}

        {reRootId && (
          <button
            className="btn"
            style={{ position: 'absolute', top: 14, left: 14, zIndex: 5 }}
            onClick={() => {
              setReRootId(null);
              setSelectedId(null);
            }}
          >
            ← Whole network
          </button>
        )}

        {allNodes.length === 0 ? (
          <div className="empty-state">
            <p className="eyebrow">No ambassadors</p>
            <p>
              The genealogy came back empty. Check that the sync has run and that
              the read-only role can see the affiliates table.
            </p>
          </div>
        ) : (
          <TreeCanvas
            roots={roots}
            collapsed={collapsed}
            selectedId={selectedId}
            lineageIds={lineageIds}
            dark={dark}
            onSelect={select}
            onToggle={toggle}
            fitToken={fitToken}
            obscuredRight={selected ? INSPECTOR_WIDTH : 0}
          />
        )}

        {selected && (
          <Inspector
            node={selected}
            lineage={lineage}
            dark={dark}
            recordUrl={recordUrl(selected)}
            onSelect={select}
            onClose={() => setSelectedId(null)}
            onReRoot={(id) => {
              setReRootId(id);
              setSelectedId(null);
            }}
          />
        )}
      </div>
    </div>
  );
};
