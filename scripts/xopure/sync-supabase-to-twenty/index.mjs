// Sync ambassadors (affiliates) and customers from the XO Pure Supabase
// project into the Twenty CRM workspace. Idempotent: tracks state in
// public.crm_sync_map on the Supabase side, keyed by source_id.
//
// Env required:
//   VITE_SUPABASE_URL        Supabase REST URL
//   SUPABASE_SERVICE_ROLE_KEY Supabase service role key for REST reads/upserts
//   TWENTY_PG_URL            Twenty (Railway) Postgres connection string (DATABASE_PUBLIC_URL)
//   TWENTY_WORKSPACE_SCHEMA  e.g. workspace_5pedu4dl120j0zsebvp6nap5w
//
// Optional env:
//   SUPABASE_PG_URL          Legacy Supabase Postgres connection string.
//                            Only used when SUPABASE_SYNC_SOURCE=pg.
//   SUPABASE_SYNC_SOURCE=pg  Use direct Supabase Postgres instead of REST.
//   DRY_RUN=1                Read + plan, no writes
//   IMPORTED_BY_NAME         createdByName tag for imported records (default: "Supabase Sync")

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

const loadLocalEnv = () => {
  const envUrl = new URL('../../../.env', import.meta.url);
  if (!fs.existsSync(envUrl)) return;

  const parsed = {};
  for (const line of fs.readFileSync(envUrl, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const getRailwayPostgresPublicUrl = () => {
  try {
    const output = execFileSync(
      'railway',
      ['variables', '--service', 'Postgres', '--environment', 'production', '--kv'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );

    return output
      .split(/\r?\n/)
      .find((line) => line.startsWith('DATABASE_PUBLIC_URL='))
      ?.slice('DATABASE_PUBLIC_URL='.length);
  } catch {
    return undefined;
  }
};

loadLocalEnv();

const SUPABASE_SYNC_SOURCE = process.env.SUPABASE_SYNC_SOURCE ?? 'rest';
const SUPABASE_PG_URL = process.env.SUPABASE_PG_URL ?? process.env.CONNECTION_STRING;
const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  ''
).replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TWENTY_PG_URL =
  process.env.TWENTY_PG_URL ??
  process.env.DATABASE_PUBLIC_URL ??
  process.env.PG_DATABASE_URL ??
  getRailwayPostgresPublicUrl();
const WS =
  process.env.TWENTY_WORKSPACE_SCHEMA ??
  'workspace_5pedu4dl120j0zsebvp6nap5w';
const DRY_RUN = process.env.DRY_RUN === '1';
const IMPORTED_BY_NAME = process.env.IMPORTED_BY_NAME ?? 'Supabase Sync';

if (!TWENTY_PG_URL || !WS) {
  console.error(
    'Missing env. Need TWENTY_PG_URL and TWENTY_WORKSPACE_SCHEMA.',
  );
  process.exit(1);
}

if (SUPABASE_SYNC_SOURCE === 'pg' && !SUPABASE_PG_URL) {
  console.error('Missing env. Need SUPABASE_PG_URL when SUPABASE_SYNC_SOURCE=pg.');
  process.exit(1);
}

if (
  SUPABASE_SYNC_SOURCE !== 'pg' &&
  (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
) {
  console.error(
    'Missing env. Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const splitName = (full) => {
  if (!full || typeof full !== 'string') return { first: '', last: '' };
  const trimmed = full.trim();
  if (!trimmed) return { first: '', last: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

const hash = (obj) =>
  crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');

const log = (...args) => console.log('[sync]', ...args);

const twenty = new Client({
  connectionString: TWENTY_PG_URL,
  ssl: { rejectUnauthorized: false },
});

const supabasePg =
  SUPABASE_SYNC_SOURCE === 'pg'
    ? new Client({ connectionString: SUPABASE_PG_URL })
    : null;

const supabaseRest = async (path, { method = 'GET', params, body } = {}) => {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(method === 'POST' || method === 'PATCH'
        ? { prefer: 'resolution=merge-duplicates,return=minimal' }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(
      `Supabase REST ${method} ${url.pathname} failed (${res.status}): ${text}`,
    );
    error.status = res.status;
    error.body = text;
    throw error;
  }

  if (res.status === 204) {
    return [];
  }

  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const getSyncMap = async ({ sourceSystem, sourceTable, sourceId }) => {
  if (supabasePg) {
    const mapRes = await supabasePg.query(
      `select twenty_record_id, content_hash from public.crm_sync_map
       where source_system=$1 and source_table=$2 and source_id=$3
         and twenty_object='person'`,
      [sourceSystem, sourceTable, sourceId],
    );

    return mapRes.rows[0];
  }

  const rows = await supabaseRest('crm_sync_map', {
    params: {
      select: 'twenty_record_id,content_hash',
      source_system: `eq.${sourceSystem}`,
      source_table: `eq.${sourceTable}`,
      source_id: `eq.${sourceId}`,
      twenty_object: 'eq.person',
      limit: 1,
    },
  });

  return rows[0];
};

const getSyncMapByTwentyId = async ({ twentyId }) => {
  if (supabasePg) {
    const mapRes = await supabasePg.query(
      `select source_system, source_schema, source_table, source_id
         from public.crm_sync_map
        where twenty_object='person' and twenty_record_id=$1
        limit 1`,
      [twentyId],
    );

    return mapRes.rows[0];
  }

  const rows = await supabaseRest('crm_sync_map', {
    params: {
      select: 'source_system,source_schema,source_table,source_id',
      twenty_object: 'eq.person',
      twenty_record_id: `eq.${twentyId}`,
      limit: 1,
    },
  });

  return rows[0];
};

const reassignSyncMapByTwentyId = async ({
  sourceSystem,
  sourceTable,
  sourceId,
  twentyId,
  contentHash,
  payload,
}) => {
  if (supabasePg) {
    await supabasePg.query(
      `update public.crm_sync_map
          set source_system=$1,
              source_schema='public',
              source_table=$2,
              source_id=$3,
              content_hash=$4,
              last_payload=$5,
              last_written_by=$6,
              last_synced_at=now(),
              last_error=null,
              retry_count=0
        where twenty_object='person' and twenty_record_id=$7`,
      [
        sourceSystem,
        sourceTable,
        sourceId,
        contentHash,
        payload,
        IMPORTED_BY_NAME,
        twentyId,
      ],
    );
    return;
  }

  await supabaseRest('crm_sync_map', {
    method: 'PATCH',
    params: {
      twenty_object: 'eq.person',
      twenty_record_id: `eq.${twentyId}`,
    },
    body: {
      source_system: sourceSystem,
      source_schema: 'public',
      source_table: sourceTable,
      source_id: sourceId,
      content_hash: contentHash,
      last_payload: payload,
      last_written_by: IMPORTED_BY_NAME,
      last_synced_at: new Date().toISOString(),
      last_error: null,
      retry_count: 0,
    },
  });
};

const upsertSyncMap = async ({
  sourceSystem,
  sourceTable,
  sourceId,
  twentyId,
  contentHash,
  payload,
}) => {
  if (supabasePg) {
    await supabasePg.query(
      `insert into public.crm_sync_map
        (source_system, source_schema, source_table, source_id,
         twenty_object, twenty_record_id, sync_direction,
         content_hash, last_payload, last_written_by, last_synced_at)
       values ($1,'public',$2,$3,'person',$4,'supabase_to_twenty',$5,$6,$7,now())
       on conflict (source_system, source_schema, source_table, source_id)
       do update set twenty_record_id = excluded.twenty_record_id,
                     content_hash = excluded.content_hash,
                     last_payload = excluded.last_payload,
                     last_written_by = excluded.last_written_by,
                     last_synced_at = now(),
                     last_error = null,
                     retry_count = 0`,
      [
        sourceSystem,
        sourceTable,
        sourceId,
        twentyId,
        contentHash,
        payload,
        IMPORTED_BY_NAME,
      ],
    );
    return;
  }

  const body = {
    source_system: sourceSystem,
    source_schema: 'public',
    source_table: sourceTable,
    source_id: sourceId,
    twenty_object: 'person',
    twenty_record_id: twentyId,
    sync_direction: 'supabase_to_twenty',
    content_hash: contentHash,
    last_payload: payload,
    last_written_by: IMPORTED_BY_NAME,
    last_synced_at: new Date().toISOString(),
    last_error: null,
    retry_count: 0,
  };

  try {
    await supabaseRest('crm_sync_map', {
      method: 'POST',
      params: {
        on_conflict: 'source_system,source_schema,source_table,source_id',
      },
      body,
    });
  } catch (error) {
    if (
      error.status !== 409 ||
      !String(error.body).includes('crm_sync_map_twenty_unique')
    ) {
      throw error;
    }

    const existing = await getSyncMapByTwentyId({ twentyId });

    if (existing?.source_table === sourceTable) {
      await reassignSyncMapByTwentyId({
        sourceSystem,
        sourceTable,
        sourceId,
        twentyId,
        contentHash,
        payload,
      });
    }
  }
};

const listAffiliates = async () => {
  if (supabasePg) {
    const { rows } = await supabasePg.query(
      `select id, email, name, tracking_code, status, created_at
         from public.affiliates
        order by created_at`,
    );
    return rows;
  }

  return await supabaseRest('affiliates', {
    params: {
      select: 'id,email,name,tracking_code,status,created_at',
      order: 'created_at.asc',
    },
  });
};

const listDistinctOrderEmails = async () => {
  if (supabasePg) {
    const { rows } = await supabasePg.query(
      `select distinct on (lower(user_email))
              user_email,
              min(created_at) over (partition by lower(user_email)) as first_seen
         from public.orders
        where user_email is not null and length(user_email) > 0`,
    );
    return rows;
  }

  const rows = await supabaseRest('orders', {
    params: {
      select: 'user_email,created_at',
      user_email: 'not.is.null',
      order: 'created_at.asc',
    },
  });

  const byEmail = new Map();
  for (const row of rows) {
    const email = row.user_email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    const existing = byEmail.get(key);
    if (!existing || row.created_at < existing.first_seen) {
      byEmail.set(key, {
        user_email: email,
        first_seen: row.created_at,
      });
    }
  }

  return [...byEmail.values()];
};

if (supabasePg) {
  await supabasePg.connect();
}
await twenty.connect();
log(`connected. dry_run=${DRY_RUN} workspace=${WS} supabase=${SUPABASE_SYNC_SOURCE}`);

const stats = {
  affiliates: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  customers: { read: 0, inserted: 0, updated: 0, skipped: 0 },
};

const upsertPerson = async ({
  sourceSystem,
  sourceTable,
  sourceId,
  payload,
  jobTitle,
}) => {
  const contentHash = hash(payload);

  const mapping = await getSyncMap({ sourceSystem, sourceTable, sourceId });
  let twentyId = mapping?.twenty_record_id ?? null;
  let action = 'skipped';
  let matchedByEmail = false;
  let existingMapForTwentyId = null;

  // Verify existing person actually still exists (could have been soft-deleted)
  let existingPerson = null;
  if (twentyId) {
    const r = await twenty.query(
      `select id, "deletedAt" from "${WS}".person where id=$1`,
      [twentyId],
    );
    existingPerson = r.rows[0] ?? null;
    if (!existingPerson) twentyId = null;
  }

  // Also try email-based match if no mapping yet (avoid creating duplicates)
  if (!twentyId && payload.email) {
    const r = await twenty.query(
      `select id, "deletedAt" from "${WS}".person
       where lower("emailsPrimaryEmail") = lower($1)
         and "deletedAt" is null
       limit 1`,
      [payload.email],
    );
    if (r.rows[0]) {
      existingPerson = r.rows[0];
      twentyId = existingPerson.id;
      matchedByEmail = true;
    }
  }

  if (matchedByEmail && !mapping) {
    existingMapForTwentyId = await getSyncMapByTwentyId({ twentyId });
  }

  const isCrossSourceEmailMatch =
    matchedByEmail &&
    existingMapForTwentyId &&
    existingMapForTwentyId.source_table !== sourceTable;

  if (isCrossSourceEmailMatch) {
    action = 'skipped';
  } else if (!twentyId) {
    // INSERT
    if (DRY_RUN) {
      action = 'inserted';
    } else {
      const posRes = await twenty.query(
        `select coalesce(max(position), 0) + 1 as next from "${WS}".person`,
      );
      const position = posRes.rows[0].next;
      const ins = await twenty.query(
        `insert into "${WS}".person
          ("nameFirstName","nameLastName","emailsPrimaryEmail","jobTitle",
           position,"createdBySource","createdByName","createdByWorkspaceMemberId","createdAt","updatedAt")
         values ($1,$2,$3,$4,$5,'IMPORT',$6,null,now(),now())
         returning id`,
        [
          payload.firstName,
          payload.lastName,
          payload.email ?? '',
          jobTitle ?? '',
          position,
          IMPORTED_BY_NAME,
        ],
      );
      twentyId = ins.rows[0].id;
      action = 'inserted';
    }
  } else if (mapping?.content_hash === contentHash && existingPerson?.deletedAt == null) {
    action = 'skipped';
  } else {
    if (!DRY_RUN) {
      await twenty.query(
        `update "${WS}".person
            set "nameFirstName" = $2,
                "nameLastName"  = $3,
                "emailsPrimaryEmail" = $4,
                "jobTitle" =
                  case
                    when $6::boolean then coalesce(nullif("jobTitle", ''), $5)
                    else coalesce(nullif($5,''), "jobTitle")
                  end,
                "deletedAt" = null,
                "updatedAt" = now()
          where id = $1`,
        [
          twentyId,
          payload.firstName,
          payload.lastName,
          payload.email ?? '',
          jobTitle ?? '',
          sourceTable === 'orders',
        ],
      );
    }
    action = 'updated';
  }

  if (!DRY_RUN) {
    await upsertSyncMap({
      sourceSystem,
      sourceTable,
      sourceId,
      twentyId,
      contentHash,
      payload,
    });
  }

  return action;
};

// 1) Affiliates → Twenty people (tagged "Ambassador")
{
  const rows = await listAffiliates();
  stats.affiliates.read = rows.length;
  for (const row of rows) {
    const { first, last } = splitName(row.name);
    const payload = {
      firstName: first,
      lastName: last,
      email: row.email,
      trackingCode: row.tracking_code,
      status: row.status,
    };
    const action = await upsertPerson({
      sourceSystem: 'supabase',
      sourceTable: 'affiliates',
      sourceId: row.id,
      payload,
      jobTitle: 'Ambassador',
    });
    stats.affiliates[action] += 1;
    log(`affiliate ${row.email} -> ${action}`);
  }
}

// 2) Customers (distinct buyers from orders) → Twenty people
{
  const rows = await listDistinctOrderEmails();
  stats.customers.read = rows.length;
  for (const row of rows) {
    const payload = {
      firstName: '',
      lastName: '',
      email: row.user_email,
      firstOrderAt: row.first_seen,
    };
    const action = await upsertPerson({
      sourceSystem: 'supabase',
      sourceTable: 'orders',
      sourceId: row.user_email.toLowerCase(),
      payload,
      jobTitle: 'Customer',
    });
    stats.customers[action] += 1;
    log(`customer ${row.user_email} -> ${action}`);
  }
}

log('done');
console.table(stats);

if (supabasePg) {
  await supabasePg.end();
}
await twenty.end();
