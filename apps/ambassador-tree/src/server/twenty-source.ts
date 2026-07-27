import 'server-only';

import { Pool, type PoolClient } from 'pg';

/**
 * Read-only access to the TWENTY workspace database.
 *
 * Twenty's Postgres is a legitimate write target elsewhere in this repo (the
 * sync populates it), but this visualization only ever reads. The connection
 * is opened read-only so a mistake here cannot corrupt the CRM mirror.
 *
 * Credentials are server-side only.
 */

/**
 * Postgres cannot parameterize an identifier, so the workspace schema is
 * interpolated. Allowlist it to exactly Twenty's generated shape — anything
 * else is rejected rather than escaped, so there is no injection surface.
 */
const SCHEMA_PATTERN = /^workspace_[a-z0-9]{1,64}$/;

export class InvalidSchemaError extends Error {
  constructor(value: string) {
    super(
      `Refusing to use "${value}" as a workspace schema. Expected ` +
        'workspace_<alphanumeric>. Set TWENTY_WORKSPACE_SCHEMA correctly.',
    );
    this.name = 'InvalidSchemaError';
  }
}

export const assertWorkspaceSchema = (value: string): string => {
  if (!SCHEMA_PATTERN.test(value)) throw new InvalidSchemaError(value);

  return value;
};

let pool: Pool | null = null;

export const getTwentyPool = (): Pool => {
  if (pool) return pool;

  const connectionString = process.env.TWENTY_PG_URL;

  if (!connectionString) {
    throw new Error(
      'TWENTY_PG_URL is not set. Point it at the Twenty workspace database ' +
        '(the `Postgres` Railway service, database `twenty_v2`).',
    );
  }

  pool = new Pool({
    connectionString,
    // Read-only enforced by the server, not merely by convention.
    options: '-c default_transaction_read_only=on',
    max: Number(process.env.TWENTY_PG_POOL_MAX ?? 4),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: Number(process.env.TWENTY_PG_STATEMENT_TIMEOUT_MS ?? 30_000),
    ssl: needsSsl(connectionString)
      ? { rejectUnauthorized: process.env.TWENTY_PG_SSL_NO_VERIFY !== '1' }
      : undefined,
  });

  return pool;
};

// Railway's public proxy terminates TLS; an internal .railway.internal host
// does not offer it at all, and asking for SSL there fails the connection.
const needsSsl = (url: string): boolean => !/\.railway\.internal/.test(url);

export const twentyReadQuery = async <TRow>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<TRow[]> => {
  const client: PoolClient = await getTwentyPool().connect();

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

/**
 * Required — deliberately no default. A hardcoded schema is both an
 * environment leak and a foot-gun: the previous default pointed at a
 * workspace that had been retired, so it failed silently against the wrong
 * database rather than loudly against none.
 */
export const workspaceSchema = (): string => {
  const schema = process.env.TWENTY_WORKSPACE_SCHEMA;

  if (!schema) {
    throw new Error(
      'TWENTY_WORKSPACE_SCHEMA is not set. Find it with: ' +
        "select nspname from pg_namespace where nspname like 'workspace_%';",
    );
  }

  return assertWorkspaceSchema(schema);
};
