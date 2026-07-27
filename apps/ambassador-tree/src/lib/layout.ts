/**
 * Node-link layout math.
 *
 * d3-hierarchy is used for the Reingold–Tilford tidy-tree computation ONLY.
 * It never touches the DOM — React owns rendering. Keeping the math here means
 * the geometry is unit testable without a browser.
 */

import { hierarchy, tree as d3tree, type HierarchyPointNode } from 'd3-hierarchy';

import { type TreeNode, walk } from './tree';

export type Orientation = 'horizontal' | 'vertical';

export interface LayoutOptions {
  /** Root-left growing right, or root-top growing down. */
  readonly orientation?: Orientation;
  /** Gap between siblings on the cross axis, in px. */
  readonly nodeSpacing?: number;
  /** Gap between generations on the depth axis, in px. */
  readonly levelSpacing?: number;
  /** Ids whose children are hidden. */
  readonly collapsed?: ReadonlySet<string>;
}

export interface LayoutNode {
  readonly node: TreeNode;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  /** True when this node has children that are currently hidden. */
  readonly collapsed: boolean;
  /** Descendants hidden behind a collapsed node — drives the "+N" badge. */
  readonly hiddenDescendants: number;
}

export interface LayoutLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly source: { readonly x: number; readonly y: number };
  readonly target: { readonly x: number; readonly y: number };
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface TreeLayout {
  readonly nodes: readonly LayoutNode[];
  readonly links: readonly LayoutLink[];
  readonly bounds: Bounds;
}

const DEFAULTS = {
  orientation: 'horizontal' as Orientation,
  nodeSpacing: 64,
  levelSpacing: 260,
};

const EMPTY_BOUNDS: Bounds = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
  width: 0,
  height: 0,
};

/** Total descendants below a node, ignoring collapse state. */
export const descendantCount = (node: TreeNode): number => {
  let count = 0;
  for (const child of node.children) count += 1 + descendantCount(child);

  return count;
};

/**
 * Lay a single root out as a tidy tree.
 *
 * Collapsed nodes are leaves for layout purposes; their hidden descendant count
 * is reported so the renderer can badge them rather than silently drop them.
 */
export const layoutTree = (
  root: TreeNode,
  options: LayoutOptions = {},
): TreeLayout => {
  const orientation = options.orientation ?? DEFAULTS.orientation;
  const nodeSpacing = options.nodeSpacing ?? DEFAULTS.nodeSpacing;
  const levelSpacing = options.levelSpacing ?? DEFAULTS.levelSpacing;
  const collapsed = options.collapsed ?? new Set<string>();

  const root$ = hierarchy<TreeNode>(root, (node) =>
    collapsed.has(node.id) ? [] : node.children,
  );

  // nodeSize keeps spacing constant regardless of tree size, which is what a
  // pan/zoom canvas wants — a fixed-extent layout would squash a wide tree.
  d3tree<TreeNode>()
    .nodeSize([nodeSpacing, levelSpacing])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.4))(root$);

  const points = root$.descendants() as HierarchyPointNode<TreeNode>[];

  // d3 lays out along (x = cross axis, y = depth). Horizontal swaps them.
  const project = (p: HierarchyPointNode<TreeNode>) =>
    orientation === 'horizontal' ? { x: p.y, y: p.x } : { x: p.x, y: p.y };

  const nodes: LayoutNode[] = points.map((point) => {
    const { x, y } = project(point);
    const isCollapsed = collapsed.has(point.data.id) && point.data.children.length > 0;

    return {
      node: point.data,
      x,
      y,
      depth: point.depth,
      collapsed: isCollapsed,
      hiddenDescendants: isCollapsed ? descendantCount(point.data) : 0,
    };
  });

  const links: LayoutLink[] = points
    .filter((point) => point.parent !== null)
    .map((point) => {
      const parent = point.parent as HierarchyPointNode<TreeNode>;

      return {
        id: `${parent.data.id}->${point.data.id}`,
        sourceId: parent.data.id,
        targetId: point.data.id,
        source: project(parent),
        target: project(point),
      };
    });

  return { nodes, links, bounds: boundsOf(nodes) };
};

/**
 * Lay out a whole forest, stacking each root's layout so they never overlap.
 * Real genealogy data has more than one root (orphans, lazy-loaded subtrees).
 */
export const layoutForest = (
  roots: readonly TreeNode[],
  options: LayoutOptions = {},
): TreeLayout => {
  const orientation = options.orientation ?? DEFAULTS.orientation;
  const nodeSpacing = options.nodeSpacing ?? DEFAULTS.nodeSpacing;
  const gap = nodeSpacing * 2;

  const nodes: LayoutNode[] = [];
  const links: LayoutLink[] = [];
  let offset = 0;

  for (const root of roots) {
    const sub = layoutTree(root, options);

    // Shift along the cross axis so this root clears the previous one.
    const shift = offset - (orientation === 'horizontal' ? sub.bounds.minY : sub.bounds.minX);

    for (const node of sub.nodes) {
      nodes.push(
        orientation === 'horizontal'
          ? { ...node, y: node.y + shift }
          : { ...node, x: node.x + shift },
      );
    }

    for (const link of sub.links) {
      links.push(
        orientation === 'horizontal'
          ? {
              ...link,
              source: { x: link.source.x, y: link.source.y + shift },
              target: { x: link.target.x, y: link.target.y + shift },
            }
          : {
              ...link,
              source: { x: link.source.x + shift, y: link.source.y },
              target: { x: link.target.x + shift, y: link.target.y },
            },
      );
    }

    const span =
      orientation === 'horizontal'
        ? sub.bounds.maxY - sub.bounds.minY
        : sub.bounds.maxX - sub.bounds.minX;

    offset += span + gap;
  }

  return { nodes, links, bounds: boundsOf(nodes) };
};

export const boundsOf = (nodes: readonly LayoutNode[]): Bounds => {
  if (nodes.length === 0) return EMPTY_BOUNDS;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const { x, y } of nodes) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

// ─── Collapse state ─────────────────────────────────────────────────────────

/**
 * Initial collapse set: show `visibleDepth` generations, fold the rest.
 * Two to three generations is the readable default for a wide downline.
 */
export const collapseBeyondDepth = (
  roots: readonly TreeNode[],
  visibleDepth: number,
): Set<string> => {
  const collapsed = new Set<string>();

  const visit = (node: TreeNode, depth: number): void => {
    if (depth >= visibleDepth && node.children.length > 0) collapsed.add(node.id);
    for (const child of node.children) visit(child, depth + 1);
  };

  for (const root of roots) visit(root, 0);

  return collapsed;
};

/** Expand every ancestor of `id` so the node becomes visible. */
export const expandToNode = (
  roots: readonly TreeNode[],
  id: string,
  collapsed: ReadonlySet<string>,
): Set<string> => {
  const next = new Set(collapsed);
  const parentOf = new Map<string, string | null>();

  for (const root of roots) {
    for (const node of walk(root)) parentOf.set(node.id, node.parentId);
  }

  const seen = new Set<string>();
  let current = parentOf.get(id) ?? null;

  while (current != null && !seen.has(current)) {
    seen.add(current);
    next.delete(current);
    current = parentOf.get(current) ?? null;
  }

  return next;
};

// ─── Viewport ───────────────────────────────────────────────────────────────

export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const IDENTITY_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

export const MIN_SCALE = 0.08;
export const MAX_SCALE = 3;

export const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/**
 * The transform that fits `bounds` inside a viewport of the given size.
 * `padding` leaves room for node cards, which extend past their anchor point.
 */
export const fitToViewport = (
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
  padding = 120,
): Viewport => {
  const width = bounds.width || 1;
  const height = bounds.height || 1;

  const availableWidth = viewportWidth - padding * 2;
  const availableHeight = viewportHeight - padding * 2;

  // Never enlarge past 1:1 — a three-node tree blown up to fill the screen
  // looks broken, not helpful.
  const scale = clampScale(Math.min(availableWidth / width, 1));

  // If the tree still overflows vertically at that scale — the normal case for
  // a genealogy, which runs roughly 6:1 — keep this readable width and let the
  // operator scroll down the column. Obeying the height instead would drive
  // the scale to ~15% and produce a grey smear rather than a diagram.
  if (height * scale > availableHeight) {
    return {
      scale,
      x: viewportWidth / 2 - (bounds.minX + width / 2) * scale,
      y: padding - bounds.minY * scale,
    };
  }

  // It fits both ways: centre it.
  return {
    scale,
    x: viewportWidth / 2 - (bounds.minX + width / 2) * scale,
    y: viewportHeight / 2 - (bounds.minY + height / 2) * scale,
  };
};

/** Zoom about a fixed screen point, so the cursor stays anchored. */
export const zoomAbout = (
  viewport: Viewport,
  factor: number,
  pointX: number,
  pointY: number,
): Viewport => {
  const scale = clampScale(viewport.scale * factor);
  const ratio = scale / viewport.scale;

  return {
    scale,
    x: pointX - (pointX - viewport.x) * ratio,
    y: pointY - (pointY - viewport.y) * ratio,
  };
};

/** Centre the viewport on a layout point without changing zoom. */
export const centerOn = (
  viewport: Viewport,
  pointX: number,
  pointY: number,
  viewportWidth: number,
  viewportHeight: number,
): Viewport => ({
  scale: viewport.scale,
  x: viewportWidth / 2 - pointX * viewport.scale,
  y: viewportHeight / 2 - pointY * viewport.scale,
});

// ─── Edge geometry ──────────────────────────────────────────────────────────

/**
 * Cubic bezier between two layout points, curving along the depth axis.
 * A straight polyline reads as a wiring diagram; the curve reads as lineage.
 */
export const linkPath = (link: LayoutLink, orientation: Orientation): string => {
  const { source, target } = link;

  if (orientation === 'horizontal') {
    const mid = (source.x + target.x) / 2;

    return `M${source.x},${source.y}C${mid},${source.y} ${mid},${target.y} ${target.x},${target.y}`;
  }

  const mid = (source.y + target.y) / 2;

  return `M${source.x},${source.y}C${source.x},${mid} ${target.x},${mid} ${target.x},${target.y}`;
};
