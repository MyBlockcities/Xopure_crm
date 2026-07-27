import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { demoRows } from '../lib/demo';
import { buildTree, type AmbassadorRow, type TreeNode } from '../lib/tree';
import { readQuery } from './db';
import { twentyReadQuery, workspaceSchema } from './twenty-source';

/**
 * Loads the genealogy and stratifies it into a forest.
 *
 * Three sources, chosen by TREE_SOURCE:
 *   twenty   (default) — the Twenty workspace mirror. Needs no Supabase
 *                        credential, and its ids are directly deep-linkable.
 *   supabase          — the original recursive CTE over affiliates.parent_id.
 *   demo              — seeded fiction, for building the UI with no database.
 *
 * The SQL lives in sql/ rather than inline so a human can review and run it
 * against a replica unchanged.
 */

export type TreeSource = 'twenty' | 'supabase' | 'demo';

/**
 * Gaps in what the sync populated. Surfaced in the UI so a missing number
 * reads as missing rather than as a confident zero (§2.6).
 */
export interface DataHealth {
  readonly ordersTotal: number;
  readonly ordersMissingDate: number;
  readonly ordersUnattributed: number;
  readonly commissionsTotal: number;
  readonly commissionsMissingPayArea: number;
  readonly ambassadorsBrokenSponsor: number;
}

export interface TreePayload {
  readonly roots: readonly TreeNode[];
  readonly nodeCount: number;
  /** Reported, never hidden — a parent outside the loaded window (guide §5). */
  readonly orphanIds: readonly string[];
  /** Always a data bug. Surfaced so a human can fix the sponsor. */
  readonly cycleIds: readonly string[];
  readonly rootId: string | null;
  readonly maxDepth: number;
  readonly source: TreeSource;
  readonly generatedAt: string;
  /** Null when the source cannot report it (demo, or Supabase). */
  readonly health: DataHealth | null;
}

export const DEFAULT_MAX_DEPTH = Number(process.env.TREE_MAX_DEPTH ?? 12);

const sqlCache = new Map<string, string>();

const loadSql = async (file: string): Promise<string> => {
  const cached = sqlCache.get(file);
  if (cached) return cached;

  const text = await readFile(path.join(process.cwd(), 'sql', file), 'utf8');
  sqlCache.set(file, text);

  return text;
};

export const resolveSource = (): TreeSource => {
  const explicit = process.env.TREE_SOURCE as TreeSource | undefined;

  if (explicit === 'twenty' || explicit === 'supabase' || explicit === 'demo') {
    return explicit;
  }

  if (process.env.DEMO_MODE === '1') return 'demo';
  if (process.env.TWENTY_PG_URL) return 'twenty';
  if (process.env.SUPABASE_DB_URL) return 'supabase';

  return 'demo';
};

export interface LoadOptions {
  /** Null walks every genealogy root. */
  readonly rootId?: string | null;
  readonly maxDepth?: number;
}

const fetchRows = async (
  source: TreeSource,
  rootId: string | null,
  maxDepth: number,
): Promise<AmbassadorRow[]> => {
  if (source === 'demo') return demoRows({ maxDepth });

  if (source === 'twenty') {
    const schema = workspaceSchema();
    const sql = (await loadSql('ambassador-tree-twenty.sql')).replaceAll(
      '{{schema}}',
      `"${schema}"`,
    );

    return twentyReadQuery<AmbassadorRow>(sql, [rootId, maxDepth]);
  }

  return readQuery<AmbassadorRow>(
    await loadSql('ambassador-tree.sql'),
    [rootId, maxDepth],
  );
};

export const loadTree = async (options: LoadOptions = {}): Promise<TreePayload> => {
  const source = resolveSource();
  const rootId = options.rootId ?? null;
  const maxDepth = clampDepth(options.maxDepth ?? DEFAULT_MAX_DEPTH);

  const rows = await fetchRows(source, rootId, maxDepth);
  const { roots, orphanIds, cycleIds, nodeCount } = buildTree(rows);
  const health = source === 'twenty' ? await loadHealth() : null;

  return {
    roots,
    nodeCount,
    orphanIds,
    cycleIds,
    rootId,
    maxDepth,
    source,
    generatedAt: new Date().toISOString(),
    health,
  };
};

const toInt = (value: unknown): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Health is best-effort: a failure here must never take the tree down with it,
 * because the tree is the thing the operator actually came for.
 */
const loadHealth = async (): Promise<DataHealth | null> => {
  try {
    const schema = workspaceSchema();
    const sql = (await loadSql('data-health.sql')).replaceAll(
      '{{schema}}',
      `"${schema}"`,
    );
    const [row] = await twentyReadQuery<Record<string, unknown>>(sql);

    if (!row) return null;

    return {
      ordersTotal: toInt(row.orders_total),
      ordersMissingDate: toInt(row.orders_missing_date),
      ordersUnattributed: toInt(row.orders_unattributed),
      commissionsTotal: toInt(row.commissions_total),
      commissionsMissingPayArea: toInt(row.commissions_missing_pay_area),
      ambassadorsBrokenSponsor: toInt(row.ambassadors_broken_sponsor),
    };
  } catch (error) {
    console.warn('[ambassador-tree] data health unavailable', error);

    return null;
  }
};

const clampDepth = (depth: number): number =>
  Number.isFinite(depth) ? Math.min(40, Math.max(1, Math.floor(depth))) : DEFAULT_MAX_DEPTH;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept a root id only if it is a UUID (or a demo id in demo mode).
 * The value reaches Postgres as a bound parameter regardless, but rejecting it
 * early turns a bad link into a clear 400 instead of a driver error.
 */
export const parseRootId = (raw: string | null): string | null => {
  if (!raw) return null;
  if (UUID.test(raw)) return raw;
  if (resolveSource() === 'demo' && /^demo-[a-z0-9-]+$/i.test(raw)) return raw;

  return null;
};
