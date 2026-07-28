import { describe, expect, it } from 'vitest';

import { demoRows } from '../lib/demo';
import { buildTree } from '../lib/tree';
import { visualizationGraphFromRoots } from './from-tree-node';
import { validateVisualizationGraph } from './validate';

describe('visualizationGraphFromRoots', () => {
  it('is deterministic and preserves every business node', async () => {
    const built = buildTree(demoRows({ seed: 42, size: 40 }));
    const first = await visualizationGraphFromRoots(built.roots, {
      source: 'demo',
    });
    const second = await visualizationGraphFromRoots(built.roots, {
      source: 'demo',
    });

    expect(first).toEqual(second);
    expect(first.source.revision).toMatch(/^[0-9a-f]{64}$/);
    expect(first.nodes.filter((node) => !node.visual.badges.includes('synthetic-root')))
      .toHaveLength(built.nodeCount);
    expect(validateVisualizationGraph(first).errors).toEqual([]);
  });

  it('preserves valid zero metrics', async () => {
    const built = buildTree(demoRows({ seed: 3, size: 1 }));
    const graph = await visualizationGraphFromRoots(built.roots, {
      source: 'demo',
    });
    const root = graph.nodes.find((node) => node.id === 'demo-root');

    expect(root?.metrics.downlineSize).toBe(0);
    expect(Number.isFinite(root?.metrics.cvCents)).toBe(true);
  });

  it('uses stable ids even when display labels are duplicated', async () => {
    const rows = demoRows({ seed: 1, size: 3 }).map((row) => ({
      ...row,
      name: 'Same Name',
    }));
    const graph = await visualizationGraphFromRoots(buildTree(rows).roots, {
      source: 'demo',
    });
    const result = validateVisualizationGraph(graph);

    expect(result.errors).toEqual([]);
    expect(result.warnings.join(' ')).toContain('duplicated');
    expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(graph.nodes.length);
  });

  it('redacts an email-derived fallback label from the export graph', async () => {
    const rows = demoRows({ seed: 8, size: 1 }).map((row) => ({
      ...row,
      name: null,
      email: 'private@example.test',
    }));
    const graph = await visualizationGraphFromRoots(buildTree(rows).roots, {
      source: 'demo',
    });
    const ambassador = graph.nodes.find((node) => node.id === 'demo-root');

    expect(ambassador?.label).toBe('Ambassador demo-roo');
    expect(JSON.stringify(graph)).not.toContain('private@example.test');
  });
});
