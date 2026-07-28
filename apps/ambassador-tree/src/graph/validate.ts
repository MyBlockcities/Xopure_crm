import {
  VISUALIZATION_GRAPH_VERSION,
  type VisualizationGraphV1,
  type VisualizationNode,
} from './visualization-graph';

const MAX_NODES = 25_000;
const MAX_LABEL_LENGTH = 500;
const HEX = /^#[0-9a-f]{6}$/i;

export interface GraphValidation {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const finiteMetrics = (node: VisualizationNode): [string, number][] => [
  ['orderCount', node.metrics.orderCount],
  ['retailCents', node.metrics.retailCents],
  ['cvCents', node.metrics.cvCents],
  ['commissionLifetimeCents', node.metrics.commissionLifetimeCents],
  ['activeCustomerCount', node.metrics.activeCustomerCount],
  ['downlineSize', node.metrics.downlineSize],
  ['directReferralCount', node.metrics.directReferralCount],
  ['treeDepth', node.metrics.treeDepth],
];

export const validateVisualizationGraph = (
  graph: VisualizationGraphV1,
): GraphValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (graph.schemaVersion !== VISUALIZATION_GRAPH_VERSION) {
    errors.push(`unsupported schemaVersion: ${String(graph.schemaVersion)}`);
  }

  if (graph.nodes.length === 0) errors.push('graph has no nodes');
  if (graph.nodes.length > MAX_NODES) {
    errors.push(`graph exceeds the ${MAX_NODES.toLocaleString()} node limit`);
  }

  const byId = new Map<string, VisualizationNode>();

  for (const node of graph.nodes) {
    if (!node.id) errors.push('node id must not be empty');
    if (byId.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    byId.set(node.id, node);

    if (node.label.length > MAX_LABEL_LENGTH) {
      errors.push(`node ${node.id}: label exceeds ${MAX_LABEL_LENGTH} characters`);
    }
    if (!Number.isInteger(node.order) || node.order < 0) {
      errors.push(`node ${node.id}: order must be a non-negative integer`);
    }
    if (!HEX.test(node.visual.color)) {
      errors.push(`node ${node.id}: invalid visual color ${node.visual.color}`);
    }
    for (const [name, value] of finiteMetrics(node)) {
      if (!Number.isFinite(value)) {
        errors.push(`node ${node.id}: metric ${name} is not finite`);
      }
    }
  }

  const roots = graph.nodes.filter((node) => node.parentId === null);
  if (roots.length !== 1) {
    errors.push(`expected exactly one root, found ${roots.length}`);
  }

  for (const node of graph.nodes) {
    if (node.parentId !== null && !byId.has(node.parentId)) {
      errors.push(`node ${node.id}: parent ${node.parentId} does not exist`);
    }
    if (node.parentId === node.id) {
      errors.push(`node ${node.id}: cannot be its own parent`);
    }
  }

  if (roots.length === 1) {
    const children = new Map<string, string[]>();
    for (const node of graph.nodes) {
      if (node.parentId === null) continue;
      const siblings = children.get(node.parentId) ?? [];
      siblings.push(node.id);
      children.set(node.parentId, siblings);
    }

    const seen = new Set<string>();
    const active = new Set<string>();
    const stack: Array<{ id: string; exit: boolean }> = [
      { id: roots[0]!.id, exit: false },
    ];

    while (stack.length > 0) {
      const item = stack.pop()!;
      if (item.exit) {
        active.delete(item.id);
        continue;
      }
      if (active.has(item.id)) {
        errors.push(`cycle detected at node ${item.id}`);
        break;
      }
      if (seen.has(item.id)) continue;

      seen.add(item.id);
      active.add(item.id);
      stack.push({ id: item.id, exit: true });
      for (const childId of children.get(item.id) ?? []) {
        stack.push({ id: childId, exit: false });
      }
    }

    const unreachable = graph.nodes.filter((node) => !seen.has(node.id));
    if (unreachable.length > 0) {
      errors.push(`${unreachable.length} node(s) are unreachable from the root`);
    }
  }

  const labels = new Map<string, number>();
  for (const node of graph.nodes) {
    labels.set(node.label, (labels.get(node.label) ?? 0) + 1);
  }
  const duplicateLabels = [...labels].filter(([, count]) => count > 1);
  if (duplicateLabels.length > 0) {
    warnings.push(
      `${duplicateLabels.length} display label(s) are duplicated; stable ids will be used for export`,
    );
  }

  return { errors, warnings };
};

export const assertValidVisualizationGraph = (
  graph: VisualizationGraphV1,
): void => {
  const result = validateVisualizationGraph(graph);
  if (result.errors.length > 0) {
    throw new Error(`Invalid visualization graph: ${result.errors.join('; ')}`);
  }
};

