import { describe, expect, it } from 'vitest';

import { demoRows } from './demo';
import { layoutRadialTree } from './radial-layout';
import { buildTree } from './tree';

describe('layoutRadialTree', () => {
  it('places every visible node at finite coordinates', () => {
    const [root] = buildTree(demoRows({ seed: 2, size: 40 })).roots;
    const layout = layoutRadialTree(root!);

    expect(layout.nodes.length).toBeGreaterThan(1);
    expect(layout.links).toHaveLength(layout.nodes.length - 1);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(Number.isInteger(node.depth)).toBe(true);
    }
  });

  it('reports descendants hidden behind a collapsed node', () => {
    const [root] = buildTree(demoRows({ seed: 4, size: 50 })).roots;
    const child = root!.children.find((node) => node.children.length > 0)!;
    const layout = layoutRadialTree(root!, new Set([child.id]));
    const point = layout.nodes.find((node) => node.node.id === child.id);

    expect(point?.collapsed).toBe(true);
    expect(point?.hiddenDescendants).toBeGreaterThan(0);
  });
});
