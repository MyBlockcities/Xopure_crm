import 'server-only';

import { Pool, type PoolClient } from 'pg';

/**
 * Read-only Supabase access.
 *
 * ⛔ OPERATING LAW: Supabase is the read-only source of truth. This module is
 * the only place in the app that opens a connection, and it is fail-closed on
 * three independent levels:
 *
 *   1. the connection requests `default_transaction_read_only=on`, so the
 *      SERVER rejects any write even if application code asks for one;
 *   2. every statement runs inside an explicitly READ ONLY transaction;
 *   3. `assertSelectOnly()` rejects non-SELECT SQL before it is ever sent.
 *
 * Credentials are server-side only — `SUPABASE_DB_URL` must be the
 * `crm_readonly` role (GRANT SELECT only), never a service-role credential.
 */

const WRITE_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|copy|call|do|merge|refresh|reindex|vacuum|set\s+session|security\s+label)\b/i;

export class WriteAttemptError extends Error {
  constructor(sql: string) {
    super(
      'Refused to execute non-SELECT SQL against Supabase. This app is ' +
        `strictly read-only.\n---\n${sql.slice(0, 400)}`,
    );
    this.name = 'WriteAttemptError';
  }
}

/**
 * Reject anything that is not a single read.
 * Comments are stripped first so a keyword cannot hide behind one.
 */
export const assertSelectOnly = (sql: string): void => {
  const stripped = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();

  const startsWithRead = /^(select|with)\b/i.test(stripped);

  if (!startsWithRead || WRITE_KEYWORDS.test(stripped)) {
    throw new WriteAttemptError(sql);
  }
};

let pool: Pool | null = null;

const connectionString = (): string => {
  const url = process.env.SUPABASE_DB_URL;

  if (!url) {
    throw new Error(
      'SUPABASE_DB_URL is not set. It must be a crm_readonly connection ' +
        'string. Set DEMO_MODE=1 to run the UI against generated data instead.',
    );
  }

  if (/service_role|supabase_admin|postgres:\/\/postgres:/i.test(url)) {
    throw new Error(
      'SUPABASE_DB_URL looks like a privileged credential. Use the ' +
        'crm_readonly role — a service-role credential bypasses RLS and can write.',
    );
  }

  return url;
};

export const getPool = (): Pool => {
  if (pool) return pool;

  pool = new Pool({
    connectionString: connectionString(),
    // The server itself refuses writes on this connection.
    options: '-c default_transaction_read_only=on',
    max: Number(process.env.SUPABASE_DB_POOL_MAX ?? 4),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: Number(process.env.SUPABASE_DB_STATEMENT_TIMEOUT_MS ?? 20_000),
    ssl: {
      // Opt-out exists for local tunnels only. Never set this in production —
      // it disables certificate verification for this connection.
      rejectUnauthorized: process.env.SUPABASE_DB_SSL_NO_VERIFY !== '1',
    },
  });

  return pool;
};

/** Run one SELECT inside an explicit READ ONLY transaction. */
export const readQuery = async <TRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<TRow[]> => {
  assertSelectOnly(sql);

  const client: PoolClient = await getPool().connect();

  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query(sql, params as unknown[]);
    await client.query('COMMIT');

    return result.rows as TRow[];
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const isDemoMode = (): boolean =>
  process.env.DEMO_MODE === '1' || !process.env.SUPABASE_DB_URL;
