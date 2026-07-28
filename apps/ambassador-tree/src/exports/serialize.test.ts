import { describe, expect, it } from 'vitest';

import { visualizationGraphFromRoots } from '../graph/from-tree-node';
import { demoRows } from '../lib/demo';
import { buildTree } from '../lib/tree';
import { exportGraph } from './export-graph';
import {
  serializeItolFiles,
  serializeNewick,
  serializeNexus,
  serializePhyloXml,
  serializeSvg,
} from './serialize';

const graph = async () =>
  visualizationGraphFromRoots(
    buildTree(demoRows({ seed: 12, size: 35 })).roots,
    { source: 'demo', graphId: 'XO Pure Test' },
  );

describe('tree exports', () => {
  it('uses stable ids in Newick and terminates exactly once', async () => {
    const output = serializeNewick(await graph());

    expect(output).toContain('demo-root');
    expect(output.endsWith(';\n')).toBe(true);
    expect(output.match(/;/g)).toHaveLength(1);
    expect(output).not.toContain('@demo.xopure.test');
  });

  it('emits rooted Nexus with a display-label mapping', async () => {
    const output = serializeNexus(await graph());

    expect(output).toContain('#NEXUS');
    expect(output).toContain('[&R]');
    expect(output).toContain('BEGIN NOTES;');
    expect(output).toContain('XO Pure — House Account');
  });

  it('escapes labels and includes a standard PhyloXML namespace', async () => {
    const value = await graph();
    const changed = {
      ...value,
      nodes: value.nodes.map((node, index) =>
        index === 1 ? { ...node, label: `A&B <Admin> "one"` } : node,
      ),
    };
    const output = serializePhyloXml(changed);

    expect(output).toContain('xmlns="http://www.phyloxml.org"');
    expect(output).toContain('A&amp;B &lt;Admin&gt; &quot;one&quot;');
    expect(output).not.toContain('@demo.xopure.test');
  });

  it('keys every iTOL dataset by stable id, not display name', async () => {
    const value = await graph();
    const files = serializeItolFiles(value);
    const labels = files.find((file) => file.name === 'labels.txt')!.content;
    const ranks = files.find((file) => file.name === 'rank-colorstrip.txt')!.content;

    expect(labels).toContain('demo-root\tXO Pure — House Account');
    expect(ranks).toContain('demo-root\t#');
    expect(files.map((file) => file.name)).toEqual([
      'tree.nwk',
      'labels.txt',
      'rank-colorstrip.txt',
      'status-symbols.txt',
      'manifest.json',
    ]);
  });

  it('emits inert SVG without email data', async () => {
    const output = serializeSvg(await graph());

    expect(output).toContain('<svg');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('@demo.xopure.test');
  });

  it('builds a deterministic ZIP package', async () => {
    const value = await graph();
    const first = exportGraph(value, 'itol-zip');
    const second = exportGraph(value, 'itol-zip');

    expect(first.bytes).toEqual(second.bytes);
    expect([...first.bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(first.filename).toBe('XO-Pure-Test-itol.zip');
  });

  it(
    'exports a 5,000-node deep sponsor chain without overflowing the stack',
    async () => {
      const template = demoRows({ seed: 1, size: 1 })[0]!;
      const rows = Array.from({ length: 5_000 }, (_, index) => ({
        ...template,
        id: `deep-${index.toString().padStart(4, '0')}`,
        parent_id:
          index === 0 ? null : `deep-${(index - 1).toString().padStart(4, '0')}`,
        depth: index,
        name: `Ambassador ${index}`,
        email: null,
        monthly_activity: [],
      }));
      const value = await visualizationGraphFromRoots(buildTree(rows).roots, {
        source: 'demo',
        graphId: 'deep-chain',
      });
      const output = serializeNewick(value);

      expect(value.nodes).toHaveLength(5_000);
      expect(output).toContain('deep-0000');
      expect(output).toContain('deep-4999');
      expect(output.endsWith(';\n')).toBe(true);
    },
    15_000,
  );
});
