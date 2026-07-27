import { describe, expect, it } from 'vitest';

import {
  boundsOf,
  centerOn,
  clampScale,
  collapseBeyondDepth,
  descendantCount,
  expandToNode,
  fitToViewport,
  type LayoutLink,
  layoutForest,
  layoutTree,
  linkPath,
  MAX_SCALE,
  MIN_SCALE,
  zoomAbout,
} from './layout';
import { type AmbassadorRow, buildTree, type TreeNode } from './tree';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const row = (
  id: string,
  parentId: string | null,
  depth: number,
  overrides: Partial<AmbassadorRow> = {},
): AmbassadorRow => ({
  id,
  parent_id: parentId,
  depth,
  name: `Ambassador ${id}`,
  email: `${id}@xopure.test`,
  status: 'approved',
  account_type: 'AMBASSADOR',
  paid_as_rank_key: 'starter',
  career_rank_key: 'starter',
  rank_key: 'starter',
  active_customer_count: 0,
  retail_cents: 0,
  cv_cents: 0,
  order_count: 0,
  commission_lifetime_cents: 0,
  needs_sponsor_review: false,
  joined_at: '2026-01-01T00:00:00Z',
  last_order_at: null,
  monthly_activity: [],
  ...overrides,
});

//        a
//      /   \
//     b     c
//    / \
//   d   e
//       |
//       f
const rows: AmbassadorRow[] = [
  row('a', null, 0),
  row('b', 'a', 1),
  row('c', 'a', 1),
  row('d', 'b', 2),
  row('e', 'b', 2),
  row('f', 'e', 3),
];

const { roots } = buildTree(rows);
const root = roots[0] as TreeNode;

const idsOf = (nodes: readonly { readonly node: TreeNode }[]): string[] =>
  nodes.map((n) => n.node.id).sort();

// ─── descendantCount ────────────────────────────────────────────────────────

describe('descendantCount', () => {
  it('counts every descendant, not just direct children', () => {
    expect(descendantCount(root)).toBe(5);
  });

  it('returns 0 for a leaf', () => {
    const leaf = root.children.find((c) => c.id === 'c') as TreeNode;

    expect(descendantCount(leaf)).toBe(0);
  });
});

// ─── layoutTree ─────────────────────────────────────────────────────────────

describe('layoutTree', () => {
  it('positions every node exactly once', () => {
    const { nodes } = layoutTree(root);

    expect(idsOf(nodes)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('emits one link per parent-child edge', () => {
    const { links } = layoutTree(root);

    expect(links).toHaveLength(5);
    expect(links.map((l) => l.id)).toContain('a->b');
    expect(links.map((l) => l.id)).toContain('e->f');
  });

  it('advances along x by levelSpacing when horizontal', () => {
    const { nodes } = layoutTree(root, {
      orientation: 'horizontal',
      levelSpacing: 200,
    });

    const at = (id: string) => nodes.find((n) => n.node.id === id);

    expect(at('a')?.x).toBe(0);
    expect(at('b')?.x).toBe(200);
    expect(at('f')?.x).toBe(600);
  });

  it('advances along y when vertical', () => {
    const { nodes } = layoutTree(root, {
      orientation: 'vertical',
      levelSpacing: 150,
    });

    const at = (id: string) => nodes.find((n) => n.node.id === id);

    expect(at('a')?.y).toBe(0);
    expect(at('b')?.y).toBe(150);
    expect(at('f')?.y).toBe(450);
  });

  it('gives siblings distinct cross-axis positions', () => {
    const { nodes } = layoutTree(root, { orientation: 'horizontal' });
    const b = nodes.find((n) => n.node.id === 'b');
    const c = nodes.find((n) => n.node.id === 'c');

    expect(b?.y).not.toBe(c?.y);
  });

  it('records layout depth on each node', () => {
    const { nodes } = layoutTree(root);

    expect(nodes.find((n) => n.node.id === 'f')?.depth).toBe(3);
  });
});

// ─── Collapse ───────────────────────────────────────────────────────────────

describe('layoutTree with collapsed nodes', () => {
  it('omits the descendants of a collapsed node', () => {
    const { nodes } = layoutTree(root, { collapsed: new Set(['b']) });

    expect(idsOf(nodes)).toEqual(['a', 'b', 'c']);
  });

  it('reports the hidden descendant count for the badge', () => {
    const { nodes } = layoutTree(root, { collapsed: new Set(['b']) });
    const b = nodes.find((n) => n.node.id === 'b');

    expect(b?.collapsed).toBe(true);
    expect(b?.hiddenDescendants).toBe(3);
  });

  it('does not mark a childless node as collapsed', () => {
    const { nodes } = layoutTree(root, { collapsed: new Set(['c']) });
    const c = nodes.find((n) => n.node.id === 'c');

    expect(c?.collapsed).toBe(false);
    expect(c?.hiddenDescendants).toBe(0);
  });

  it('drops links into a collapsed subtree', () => {
    const { links } = layoutTree(root, { collapsed: new Set(['b']) });

    expect(links.map((l) => l.id)).toEqual(['a->b', 'a->c']);
  });
});

describe('collapseBeyondDepth', () => {
  it('collapses every node at or beyond the visible depth that has children', () => {
    // b (depth 1) and e (depth 2) both have children; d and c are leaves.
    expect([...collapseBeyondDepth(roots, 1)].sort()).toEqual(['b', 'e']);
  });

  it('leaves shallower nodes expanded', () => {
    expect(collapseBeyondDepth(roots, 2).has('b')).toBe(false);
    expect(collapseBeyondDepth(roots, 2).has('e')).toBe(true);
  });

  it('collapses nothing when the whole tree fits', () => {
    expect(collapseBeyondDepth(roots, 10).size).toBe(0);
  });

  it('collapses the root itself at depth 0', () => {
    expect([...collapseBeyondDepth(roots, 0)]).toContain('a');
  });
});

describe('expandToNode', () => {
  it('opens every ancestor of the target', () => {
    const collapsed = new Set(['a', 'b', 'e']);
    const next = expandToNode(roots, 'f', collapsed);

    expect(next.has('a')).toBe(false);
    expect(next.has('b')).toBe(false);
    expect(next.has('e')).toBe(false);
  });

  it('leaves unrelated branches collapsed', () => {
    const next = expandToNode(roots, 'd', new Set(['b', 'e']));

    expect(next.has('e')).toBe(true);
  });

  it('does not expand the target itself', () => {
    const next = expandToNode(roots, 'b', new Set(['b']));

    expect(next.has('b')).toBe(true);
  });
});

// ─── layoutForest ───────────────────────────────────────────────────────────

describe('layoutForest', () => {
  const twoRoots = buildTree([
    row('a', null, 0),
    row('b', 'a', 1),
    row('x', null, 0),
    row('y', 'x', 1),
  ]).roots;

  it('lays out every root', () => {
    const { nodes } = layoutForest(twoRoots);

    expect(idsOf(nodes)).toEqual(['a', 'b', 'x', 'y']);
  });

  it('separates roots on the cross axis so they never overlap', () => {
    const { nodes } = layoutForest(twoRoots, { orientation: 'horizontal' });
    const first = nodes.filter((n) => ['a', 'b'].includes(n.node.id));
    const second = nodes.filter((n) => ['x', 'y'].includes(n.node.id));

    const firstMaxY = Math.max(...first.map((n) => n.y));
    const secondMinY = Math.min(...second.map((n) => n.y));

    expect(secondMinY).toBeGreaterThan(firstMaxY);
  });

  it('shifts links along with their nodes', () => {
    const { nodes, links } = layoutForest(twoRoots, { orientation: 'horizontal' });
    const x = nodes.find((n) => n.node.id === 'x');
    const link = links.find((l) => l.id === 'x->y');

    expect(link?.source.y).toBe(x?.y);
  });

  it('returns empty bounds for an empty forest', () => {
    expect(layoutForest([]).bounds.width).toBe(0);
  });
});

// ─── Bounds & viewport ──────────────────────────────────────────────────────

describe('boundsOf', () => {
  it('spans the extremes of the positioned nodes', () => {
    const { bounds, nodes } = layoutTree(root, { orientation: 'horizontal' });

    expect(bounds.minX).toBe(Math.min(...nodes.map((n) => n.x)));
    expect(bounds.maxX).toBe(Math.max(...nodes.map((n) => n.x)));
    expect(bounds.width).toBe(bounds.maxX - bounds.minX);
  });
});

describe('clampScale', () => {
  it('floors at MIN_SCALE', () => {
    expect(clampScale(0.0001)).toBe(MIN_SCALE);
  });

  it('ceils at MAX_SCALE', () => {
    expect(clampScale(99)).toBe(MAX_SCALE);
  });
});

describe('fitToViewport', () => {
  it('centres the bounds in the viewport', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    const view = fitToViewport(bounds, 1000, 1000, 0);

    // Centre of the content lands on the centre of the viewport.
    expect(50 * view.scale + view.x).toBeCloseTo(500);
    expect(50 * view.scale + view.y).toBeCloseTo(500);
  });

  it('never scales past 1:1 for a small tree', () => {
    const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };

    expect(fitToViewport(bounds, 1000, 1000).scale).toBe(1);
  });

  it('shrinks a tree wider than the viewport', () => {
    const bounds = { minX: 0, minY: 0, maxX: 8000, maxY: 100, width: 8000, height: 100 };

    expect(fitToViewport(bounds, 800, 600).scale).toBeLessThan(1);
  });

  it('survives zero-size bounds', () => {
    const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

    expect(Number.isFinite(fitToViewport(bounds, 800, 600).scale)).toBe(true);
  });
});

describe('zoomAbout', () => {
  it('keeps the anchor point stationary on screen', () => {
    const before = { x: 40, y: 60, scale: 1 };
    const after = zoomAbout(before, 2, 300, 200);

    // A layout point under the cursor before must still be under it after.
    const layoutX = (300 - before.x) / before.scale;
    const layoutY = (200 - before.y) / before.scale;

    expect(layoutX * after.scale + after.x).toBeCloseTo(300);
    expect(layoutY * after.scale + after.y).toBeCloseTo(200);
  });

  it('clamps rather than zooming past the limit', () => {
    expect(zoomAbout({ x: 0, y: 0, scale: MAX_SCALE }, 4, 0, 0).scale).toBe(MAX_SCALE);
  });
});

describe('centerOn', () => {
  it('puts the requested point in the middle of the viewport', () => {
    const view = centerOn({ x: 0, y: 0, scale: 2 }, 100, 50, 800, 600);

    expect(100 * 2 + view.x).toBe(400);
    expect(50 * 2 + view.y).toBe(300);
  });

  it('preserves the zoom level', () => {
    expect(centerOn({ x: 0, y: 0, scale: 1.5 }, 0, 0, 800, 600).scale).toBe(1.5);
  });
});

// ─── Edges ──────────────────────────────────────────────────────────────────

describe('linkPath', () => {
  const link: LayoutLink = {
    id: 'a->b',
    sourceId: 'a',
    targetId: 'b',
    source: { x: 0, y: 0 },
    target: { x: 100, y: 40 },
  };

  it('starts at the source and ends at the target', () => {
    const path = linkPath(link, 'horizontal');

    expect(path.startsWith('M0,0')).toBe(true);
    expect(path.endsWith('100,40')).toBe(true);
  });

  it('curves along the depth axis for each orientation', () => {
    expect(linkPath(link, 'horizontal')).not.toBe(linkPath(link, 'vertical'));
  });
});

// ─── Tall-tree fit ──────────────────────────────────────────────────────────
// Real genealogies are far taller than wide (215 live ambassadors ≈ 6:1).
// Fitting both axes drove the scale to ~15%, which is an unreadable smear.

describe('fitToViewport on a tall tree', () => {
  const tall = {
    minX: 0,
    minY: 0,
    maxX: 1000,
    maxY: 9000,
    width: 1000,
    height: 9000,
  };

  it('does not shrink to an illegible scale', () => {
    // Obeying the height would give ~0.08 here.
    expect(fitToViewport(tall, 1200, 800).scale).toBeGreaterThan(0.5);
  });

  it('fits the width instead', () => {
    const view = fitToViewport(tall, 1200, 800, 100);

    expect(view.scale).toBeCloseTo(1000 / 1000, 1);
  });

  it('anchors to the top so the root is visible, not the middle of the column', () => {
    const view = fitToViewport(tall, 1200, 800, 100);

    // The top of the content lands near the top of the viewport, not above it.
    expect(tall.minY * view.scale + view.y).toBeGreaterThanOrEqual(0);
    expect(tall.minY * view.scale + view.y).toBeLessThan(400);
  });

  it('still centres a tree that comfortably fits', () => {
    const square = { minX: 0, minY: 0, maxX: 400, maxY: 400, width: 400, height: 400 };
    const view = fitToViewport(square, 1200, 800, 50);

    expect(200 * view.scale + view.y).toBeCloseTo(400);
  });
});
