import { canonicalJson } from '../graph/revision';
import {
  type VisualizationGraphV1,
  type VisualizationNode,
} from '../graph/visualization-graph';
import { assertValidVisualizationGraph } from '../graph/validate';
import { RANKS } from '../lib/ranks';

interface IndexedGraph {
  readonly root: VisualizationNode;
  readonly children: ReadonlyMap<string, readonly VisualizationNode[]>;
}

const indexGraph = (graph: VisualizationGraphV1): IndexedGraph => {
  assertValidVisualizationGraph(graph);
  const root = graph.nodes.find((node) => node.parentId === null)!;
  const children = new Map<string, VisualizationNode[]>();

  for (const node of graph.nodes) {
    if (node.parentId === null) continue;
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  return { root, children };
};

const newickLabel = (value: string): string => {
  if (/[\s,;:()[\]']/u.test(value)) {
    return `'${value.replaceAll("'", "''")}'`;
  }

  return value;
};

/*
 * Iterative post-order serialization avoids a call-stack failure for a deep
 * sponsor chain. CRM UUIDs are the machine-stable Newick labels.
 */
export const serializeNewick = (graph: VisualizationGraphV1): string => {
  const { root, children } = indexGraph(graph);
  const result = new Map<string, string>();
  const stack: Array<{ node: VisualizationNode; visited: boolean }> = [
    { node: root, visited: false },
  ];

  while (stack.length > 0) {
    const item = stack.pop()!;
    const childNodes = children.get(item.node.id) ?? [];
    if (!item.visited) {
      stack.push({ ...item, visited: true });
      for (let index = childNodes.length - 1; index >= 0; index -= 1) {
        stack.push({ node: childNodes[index]!, visited: false });
      }
      continue;
    }

    const nested =
      childNodes.length > 0
        ? `(${childNodes.map((child) => result.get(child.id)).join(',')})`
        : '';
    result.set(item.node.id, `${nested}${newickLabel(item.node.id)}`);
  }

  return `${result.get(root.id)};\n`;
};

const nexusLabel = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`;

export const serializeNexus = (graph: VisualizationGraphV1): string => {
  const tree = serializeNewick(graph).trim();
  const labels = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const lines = [
    '#NEXUS',
    '',
    'BEGIN TREES;',
    `  TREE ${newickLabel(graph.graphId)} = [&R] ${tree}`,
    'END;',
    '',
    '[XO Pure stable-id to display-label mapping]',
    'BEGIN NOTES;',
    ...labels.map(
      (node) => `  TEXT TAXON=${nexusLabel(node.id)} TEXT=${nexusLabel(node.label)};`,
    ),
    'END;',
    '',
  ];

  return lines.join('\n');
};

const xml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const serializePhyloXml = (graph: VisualizationGraphV1): string => {
  const { root, children } = indexGraph(graph);
  const output: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<phyloxml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xmlns="http://www.phyloxml.org"',
    '  xsi:schemaLocation="http://www.phyloxml.org http://www.phyloxml.org/1.20/phyloxml.xsd">',
    `  <phylogeny rooted="true">`,
    `    <name>${xml(graph.graphId)}</name>`,
  ];
  const stack: Array<{
    node: VisualizationNode;
    depth: number;
    close: boolean;
  }> = [{ node: root, depth: 2, close: false }];

  while (stack.length > 0) {
    const item = stack.pop()!;
    const indent = '  '.repeat(item.depth);
    if (item.close) {
      output.push(`${indent}</clade>`);
      continue;
    }

    const rank = RANKS[item.node.metrics.paidAsRank];
    const color = item.node.visual.color.slice(1);
    output.push(
      `${indent}<clade>`,
      `${indent}  <name>${xml(item.node.label)}</name>`,
      `${indent}  <property datatype="xsd:string" ref="xopure:id" applies_to="node">${xml(item.node.id)}</property>`,
      `${indent}  <property datatype="xsd:string" ref="xopure:rank" applies_to="node">${xml(rank.label)}</property>`,
      `${indent}  <property datatype="xsd:integer" ref="xopure:retail_cents" applies_to="node">${item.node.metrics.retailCents}</property>`,
      `${indent}  <property datatype="xsd:integer" ref="xopure:cv_cents" applies_to="node">${item.node.metrics.cvCents}</property>`,
      `${indent}  <color>`,
      `${indent}    <red>${parseInt(color.slice(0, 2), 16)}</red>`,
      `${indent}    <green>${parseInt(color.slice(2, 4), 16)}</green>`,
      `${indent}    <blue>${parseInt(color.slice(4, 6), 16)}</blue>`,
      `${indent}  </color>`,
    );
    stack.push({ ...item, close: true });
    const childNodes = children.get(item.node.id) ?? [];
    for (let index = childNodes.length - 1; index >= 0; index -= 1) {
      stack.push({ node: childNodes[index]!, depth: item.depth + 1, close: false });
    }
  }

  output.push('  </phylogeny>', '</phyloxml>', '');

  return output.join('\n');
};

export const serializeCanonicalGraph = (graph: VisualizationGraphV1): string =>
  `${canonicalJson(graph)}\n`;

const itolSafe = (value: string): string =>
  value.replace(/[\t\r\n]+/g, ' ').trim();

export interface ItolFile {
  readonly name: string;
  readonly content: string;
}

export const serializeItolFiles = (graph: VisualizationGraphV1): ItolFile[] => {
  indexGraph(graph);
  const nodes = graph.nodes.filter(
    (node) => !node.visual.badges.includes('synthetic-root'),
  );
  const labelLines = nodes.map(
    (node) => `${itolSafe(node.id)}\t${itolSafe(node.label)}`,
  );
  const rankLines = nodes.map(
    (node) =>
      `${itolSafe(node.id)}\t${node.visual.color}\t${itolSafe(RANKS[node.metrics.paidAsRank].label)}`,
  );
  const statusLines = nodes.map((node) => {
    const color = node.metrics.needsSponsorReview ? '#b3400e' : '#1f6f4a';
    const symbol = node.metrics.needsSponsorReview ? 2 : 1;

    return `${itolSafe(node.id)}\t${symbol}\t8\t${color}\t1\t${itolSafe(node.metrics.status ?? 'unknown')}`;
  });
  const manifest = {
    schemaVersion: 'xopure.itol-package/v1',
    graphId: graph.graphId,
    graphRevision: graph.source.revision,
    generatedBy: 'xopure-ambassador-tree',
    files: ['tree.nwk', 'labels.txt', 'rank-colorstrip.txt', 'status-symbols.txt'],
  };

  return [
    { name: 'tree.nwk', content: serializeNewick(graph) },
    {
      name: 'labels.txt',
      content: ['LABELS', 'SEPARATOR TAB', 'DATA', ...labelLines, ''].join('\n'),
    },
    {
      name: 'rank-colorstrip.txt',
      content: [
        'DATASET_COLORSTRIP',
        'SEPARATOR TAB',
        'DATASET_LABEL\tXO Pure Rank',
        'COLOR\t#0b4f6c',
        'STRIP_WIDTH\t30',
        'DATA',
        ...rankLines,
        '',
      ].join('\n'),
    },
    {
      name: 'status-symbols.txt',
      content: [
        'DATASET_SYMBOL',
        'SEPARATOR TAB',
        'DATASET_LABEL\tXO Pure Status',
        'COLOR\t#0b4f6c',
        'MAXIMUM_SIZE\t12',
        'DATA',
        ...statusLines,
        '',
      ].join('\n'),
    },
    { name: 'manifest.json', content: `${canonicalJson(manifest)}\n` },
  ];
};

export const serializeSvg = (graph: VisualizationGraphV1): string => {
  const { root, children } = indexGraph(graph);
  const depth = new Map([[root.id, 0]]);
  const ordered: VisualizationNode[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    ordered.push(node);
    const childNodes = children.get(node.id) ?? [];
    for (let index = childNodes.length - 1; index >= 0; index -= 1) {
      const child = childNodes[index]!;
      depth.set(child.id, (depth.get(node.id) ?? 0) + 1);
      stack.push(child);
    }
  }

  const row = 34;
  const column = 220;
  const padding = 40;
  const width = Math.max(...ordered.map((node) => (depth.get(node.id) ?? 0) * column)) + 420;
  const height = ordered.length * row + padding * 2;
  const position = new Map(
    ordered.map((node, index) => [
      node.id,
      { x: padding + (depth.get(node.id) ?? 0) * column, y: padding + index * row },
    ]),
  );
  const links = ordered
    .filter((node) => node.parentId !== null)
    .map((node) => {
      const from = position.get(node.parentId!)!;
      const to = position.get(node.id)!;

      return `<path d="M${from.x},${from.y} C${from.x + 90},${from.y} ${to.x - 90},${to.y} ${to.x},${to.y}" />`;
    })
    .join('');
  const marks = ordered
    .map((node) => {
      const point = position.get(node.id)!;

      return `<g><circle cx="${point.x}" cy="${point.y}" r="5" fill="${node.visual.color}" /><text x="${point.x + 10}" y="${point.y + 4}">${xml(node.label)}</text></g>`;
    })
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="XO Pure Ambassador Tree">`,
    '<style>svg{background:#edf2f4;color:#0b1f2a;font-family:system-ui,sans-serif}path{fill:none;stroke:#c0cfd8;stroke-width:1.25}text{fill:#4a6472;font-size:11px}</style>',
    links,
    marks,
    '</svg>',
    '',
  ].join('\n');
};

