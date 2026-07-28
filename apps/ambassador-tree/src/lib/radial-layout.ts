import { hierarchy, tree as d3tree } from 'd3-hierarchy';

import { type TreeNode } from './tree';

export interface RadialNode {
  readonly node: TreeNode;
  readonly depth: number;
  readonly angle: number;
  readonly radius: number;
  readonly x: number;
  readonly y: number;
  readonly collapsed: boolean;
  readonly hiddenDescendants: number;
}

export interface RadialLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly path: string;
}

export interface RadialLayout {
  readonly nodes: readonly RadialNode[];
  readonly links: readonly RadialLink[];
  readonly radius: number;
}

const descendants = (node: TreeNode): number => {
  let total = 0;
  const stack = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop()!;
    total += 1;
    stack.push(...current.children);
  }

  return total;
};

const polar = (angle: number, radius: number) => ({
  x: Math.cos(angle - Math.PI / 2) * radius,
  y: Math.sin(angle - Math.PI / 2) * radius,
});

export const radialLinkPath = (
  sourceAngle: number,
  sourceRadius: number,
  targetAngle: number,
  targetRadius: number,
): string => {
  const source = polar(sourceAngle, sourceRadius);
  const target = polar(targetAngle, targetRadius);
  const elbowA = polar(sourceAngle, targetRadius);
  const sweep = targetAngle >= sourceAngle ? 1 : 0;
  const delta = Math.abs(targetAngle - sourceAngle);
  const largeArc = delta > Math.PI ? 1 : 0;

  return [
    `M${source.x.toFixed(2)},${source.y.toFixed(2)}`,
    `L${elbowA.x.toFixed(2)},${elbowA.y.toFixed(2)}`,
    `A${targetRadius.toFixed(2)},${targetRadius.toFixed(2)} 0 ${largeArc} ${sweep} ${target.x.toFixed(2)},${target.y.toFixed(2)}`,
  ].join(' ');
};

export const layoutRadialTree = (
  root: TreeNode,
  collapsed: ReadonlySet<string> = new Set(),
  radius = 520,
): RadialLayout => {
  const root$ = hierarchy(root, (node) =>
    collapsed.has(node.id) ? [] : node.children,
  );

  d3tree<TreeNode>().size([Math.PI * 2, radius])(root$);

  const nodes: RadialNode[] = root$.descendants().map((point) => {
    const angle = point.x ?? 0;
    const pointRadius = point.y ?? 0;
    const position = polar(angle, pointRadius);
    const isCollapsed = collapsed.has(point.data.id) && point.data.children.length > 0;

    return {
      node: point.data,
      depth: point.depth,
      angle,
      radius: pointRadius,
      ...position,
      collapsed: isCollapsed,
      hiddenDescendants: isCollapsed ? descendants(point.data) : 0,
    };
  });
  const byId = new Map(nodes.map((node) => [node.node.id, node]));
  const links: RadialLink[] = root$.links().map((link) => {
    const source = byId.get(link.source.data.id)!;
    const target = byId.get(link.target.data.id)!;

    return {
      id: `${source.node.id}->${target.node.id}`,
      sourceId: source.node.id,
      targetId: target.node.id,
      path: radialLinkPath(
        source.angle,
        source.radius,
        target.angle,
        target.radius,
      ),
    };
  });

  return { nodes, links, radius };
};
