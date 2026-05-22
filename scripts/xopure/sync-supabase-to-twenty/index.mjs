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
const DEFAULT_CURRENCY_CODE = process.env.TWENTY_DEFAULT_CURRENCY_CODE ?? 'USD';
const AMBASSADOR_TABLE = '_ambassador';

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

const quoteIdent = (value) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return `"${value}"`;
};

const tableRef = (tableName) => `${quoteIdent(WS)}.${quoteIdent(tableName)}`;

const centsToAmountMicros = (cents) => {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) {
    return null;
  }

  return Math.round(Number(cents) * 10_000);
};

const normalizeSelectValue = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const mapAffiliateStatus = (status) => {
  const normalized = normalizeSelectValue(status);

  if (normalized === 'ACTIVE' || normalized === 'APPROVED') return 'ACTIVE';
  if (normalized === 'SUSPENDED' || normalized === 'BLOCKED') return 'SUSPENDED';
  if (normalized === 'INACTIVE' || normalized === 'DISABLED') return 'INACTIVE';

  return 'PENDING';
};

const mapAffiliatePath = (accountType) => {
  const normalized = normalizeSelectValue(accountType);

  if (normalized === 'ELITE') return 'ELITE';
  if (normalized === 'REFERRAL') return 'REFERRAL';

  return 'STANDARD';
};

const mapAffiliateRank = (rank) => {
  const normalized = normalizeSelectValue(rank);

  const rankMap = {
    L0_CUSTOMER: 'L0_CUSTOMER',
    CUSTOMER: 'L0_CUSTOMER',
    L1_STARTER: 'L1_STARTER',
    STARTER: 'L1_STARTER',
    AFFILIATE: 'L1_STARTER',
    ACTIVE_AFFILIATE: 'L1_STARTER',
    L2_BUILDER: 'L2_BUILDER',
    BUILDER: 'L2_BUILDER',
    L3_PROMOTER: 'L3_PROMOTER',
    PROMOTER: 'L3_PROMOTER',
    L4_LEADER: 'L4_LEADER',
    LEADER: 'L4_LEADER',
    L5_DIRECTOR: 'L5_DIRECTOR',
    DIRECTOR: 'L5_DIRECTOR',
    L6_ICON: 'L6_ICON',
    ICON: 'L6_ICON',
  };

  return rankMap[normalized] ?? 'L1_STARTER';
};

const mapOnboardingStage = (status) => {
  const mappedStatus = mapAffiliateStatus(status);

  if (mappedStatus === 'ACTIVE') return 'ACTIVE';
  if (mappedStatus === 'INACTIVE' || mappedStatus === 'SUSPENDED') {
    return 'DORMANT';
  }

  return 'INVITED';
};

const twenty = new Client({
  connectionString: TWENTY_PG_URL,
  ssl: { rejectUnauthorized: false },
});

const supabasePg =
  SUPABASE_SYNC_SOURCE === 'pg'
    ? new Client({ connectionString: SUPABASE_PG_URL })
    : null;

const tableColumnCache = new Map();

const getTableColumns = async (tableName) => {
  if (tableColumnCache.has(tableName)) {
    return tableColumnCache.get(tableName);
  }

  const { rows } = await twenty.query(
    `select column_name
       from information_schema.columns
      where table_schema = $1
        and table_name = $2`,
    [WS, tableName],
  );
  const columns = new Set(rows.map((row) => row.column_name));
  tableColumnCache.set(tableName, columns);
  return columns;
};

const assertTableExists = async (tableName, remediation) => {
  const columns = await getTableColumns(tableName);

  if (columns.size === 0) {
    throw new Error(
      `Twenty workspace table ${quoteIdent(WS)}.${quoteIdent(tableName)} does not exist. ${remediation}`,
    );
  }

  return columns;
};

const filterExistingColumns = (columns, values) =>
  Object.fromEntries(
    Object.entries(values).filter(
      ([column, value]) => value !== undefined && columns.has(column),
    ),
  );

const nextPosition = async (tableName, columns) => {
  if (!columns.has('position')) return undefined;

  const { rows } = await twenty.query(
    `select coalesce(max(position), 0) + 1 as next from ${tableRef(tableName)}`,
  );

  return rows[0]?.next;
};

const insertRecord = async (tableName, values) => {
  const columns = await getTableColumns(tableName);
  const insertValues = filterExistingColumns(columns, {
    ...values,
    position: values.position ?? (await nextPosition(tableName, columns)),
    createdBySource: values.createdBySource ?? 'IMPORT',
    createdByName: values.createdByName ?? IMPORTED_BY_NAME,
    createdByWorkspaceMemberId: values.createdByWorkspaceMemberId ?? null,
    createdAt: values.createdAt ?? new Date().toISOString(),
    updatedAt: values.updatedAt ?? new Date().toISOString(),
  });
  const entries = Object.entries(insertValues);

  if (entries.length === 0) {
    throw new Error(`No writable columns found for ${quoteIdent(tableName)} insert.`);
  }

  const columnSql = entries.map(([column]) => quoteIdent(column)).join(', ');
  const valueSql = entries.map((_, index) => `$${index + 1}`).join(', ');
  const { rows } = await twenty.query(
    `insert into ${tableRef(tableName)} (${columnSql})
     values (${valueSql})
     returning id`,
    entries.map(([, value]) => value),
  );

  return rows[0].id;
};

const updateRecord = async (tableName, id, values) => {
  const columns = await getTableColumns(tableName);
  const updateValues = filterExistingColumns(columns, {
    ...values,
    deletedAt: null,
    updatedAt: new Date().toISOString(),
  });
  const entries = Object.entries(updateValues).filter(([column]) => column !== 'id');

  if (entries.length === 0) return;

  const setSql = entries
    .map(([column], index) => `${quoteIdent(column)} = $${index + 2}`)
    .join(', ');

  await twenty.query(
    `update ${tableRef(tableName)}
        set ${setSql}
      where id = $1`,
    [id, ...entries.map(([, value]) => value)],
  );
};

const findRecordByColumn = async (tableName, columnName, value) => {
  if (value === undefined || value === null || value === '') return null;

  const columns = await getTableColumns(tableName);
  if (!columns.has(columnName)) return null;

  const { rows } = await twenty.query(
    `select id, "deletedAt"
       from ${tableRef(tableName)}
      where ${quoteIdent(columnName)} = $1
      order by "createdAt" asc
      limit 1`,
    [value],
  );

  return rows[0] ?? null;
};

const findRecordByEmail = async (tableName, email) => {
  if (!email) return null;

  const columns = await getTableColumns(tableName);
  if (!columns.has('emailsPrimaryEmail')) return null;

  const { rows } = await twenty.query(
    `select id, "deletedAt"
       from ${tableRef(tableName)}
      where lower("emailsPrimaryEmail") = lower($1)
      order by "createdAt" asc
      limit 1`,
    [email],
  );

  return rows[0] ?? null;
};

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

const getSyncMap = async ({
  sourceSystem,
  sourceTable,
  sourceId,
  twentyObject = 'person',
}) => {
  if (supabasePg) {
    const mapRes = await supabasePg.query(
      `select twenty_record_id, content_hash from public.crm_sync_map
       where source_system=$1 and source_table=$2 and source_id=$3
         and twenty_object=$4`,
      [sourceSystem, sourceTable, sourceId, twentyObject],
    );

    return mapRes.rows[0];
  }

  const rows = await supabaseRest('crm_sync_map', {
    params: {
      select: 'twenty_record_id,content_hash',
      source_system: `eq.${sourceSystem}`,
      source_table: `eq.${sourceTable}`,
      source_id: `eq.${sourceId}`,
      twenty_object: `eq.${twentyObject}`,
      limit: 1,
    },
  });

  return rows[0];
};

const getSyncMapByTwentyId = async ({ twentyObject = 'person', twentyId }) => {
  if (supabasePg) {
    const mapRes = await supabasePg.query(
      `select source_system, source_schema, source_table, source_id
         from public.crm_sync_map
        where twenty_object=$1 and twenty_record_id=$2
        limit 1`,
      [twentyObject, twentyId],
    );

    return mapRes.rows[0];
  }

  const rows = await supabaseRest('crm_sync_map', {
    params: {
      select: 'source_system,source_schema,source_table,source_id',
      twenty_object: `eq.${twentyObject}`,
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
  twentyObject = 'person',
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
        where twenty_object=$7 and twenty_record_id=$8`,
      [
        sourceSystem,
        sourceTable,
        sourceId,
        contentHash,
        payload,
        IMPORTED_BY_NAME,
        twentyObject,
        twentyId,
      ],
    );
    return;
  }

  await supabaseRest('crm_sync_map', {
    method: 'PATCH',
    params: {
      twenty_object: `eq.${twentyObject}`,
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
  twentyObject = 'person',
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
       values ($1,'public',$2,$3,$4,$5,'supabase_to_twenty',$6,$7,$8,now())
       on conflict (source_system, source_schema, source_table, source_id, twenty_object)
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
        twentyObject,
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
    twenty_object: twentyObject,
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
        on_conflict: 'source_system,source_schema,source_table,source_id,twenty_object',
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

    const existing = await getSyncMapByTwentyId({ twentyObject, twentyId });

    if (existing?.source_table === sourceTable) {
      await reassignSyncMapByTwentyId({
        sourceSystem,
        sourceTable,
        sourceId,
        twentyObject,
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
      `select id, user_id, email, name, tracking_code, parent_id, status,
              account_type, ambassador_conversion_date, active_customer_count,
              personal_volume_cents, team_volume_cents, career_rank,
              paid_as_rank, rank, created_at, updated_at
         from public.affiliates
        order by created_at`,
    );
    return rows;
  }

  return await supabaseRest('affiliates', {
    params: {
      select:
        'id,user_id,email,name,tracking_code,parent_id,status,account_type,ambassador_conversion_date,active_customer_count,personal_volume_cents,team_volume_cents,career_rank,paid_as_rank,rank,created_at,updated_at',
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
  ambassadors: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  sponsorLinks: { read: 0, linked: 0, skipped: 0, missing: 0 },
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
      twentyId = `dryrun:person:${sourceTable}:${sourceId}`;
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

  return { action, id: twentyId };
};

const ambassadorTableRemediation =
  'Run `PHASE=1 node scripts/xopure/setup-custom-objects/index.mjs` against crm.xopure.com first.';

const buildAmbassadorPayload = (row, personId) => {
  const { first, last } = splitName(row.name);
  const status = mapAffiliateStatus(row.status);

  return {
    supabaseId: row.id,
    ambassadorCode: row.tracking_code,
    firstName: first,
    lastName: last,
    email: row.email,
    status,
    path: mapAffiliatePath(row.account_type),
    enrolledAt: row.ambassador_conversion_date ?? row.created_at,
    qualifiedRank: mapAffiliateRank(row.career_rank ?? row.rank),
    paidAsRank: mapAffiliateRank(row.paid_as_rank ?? row.career_rank ?? row.rank),
    activeCustomerCount: row.active_customer_count ?? 0,
    customerCVMicros: centsToAmountMicros(row.personal_volume_cents),
    groupCVMicros: centsToAmountMicros(row.team_volume_cents),
    onboardingStage: mapOnboardingStage(row.status),
    personId,
  };
};

const ambassadorValuesFromPayload = (payload) => ({
  supabaseId: payload.supabaseId,
  ambassadorCode: payload.ambassadorCode,
  fullNameFirstName: payload.firstName,
  fullNameLastName: payload.lastName,
  emailsPrimaryEmail: payload.email ?? '',
  status: payload.status,
  path: payload.path,
  enrolledAt: payload.enrolledAt,
  qualifiedRank: payload.qualifiedRank,
  paidAsRank: payload.paidAsRank,
  activeCustomerCount: payload.activeCustomerCount,
  customerCVAmountMicros: payload.customerCVMicros,
  customerCVCurrencyCode:
    payload.customerCVMicros === null ? undefined : DEFAULT_CURRENCY_CODE,
  groupCVAmountMicros: payload.groupCVMicros,
  groupCVCurrencyCode:
    payload.groupCVMicros === null ? undefined : DEFAULT_CURRENCY_CODE,
  onboardingStage: payload.onboardingStage,
  personId: payload.personId,
});

const upsertAmbassador = async ({ row, personId }) => {
  const columns = await assertTableExists(AMBASSADOR_TABLE, ambassadorTableRemediation);

  if (!columns.has('personId')) {
    throw new Error(
      `Twenty ambassador table is missing personId. ${ambassadorTableRemediation}`,
    );
  }

  const payload = buildAmbassadorPayload(row, personId);
  const contentHash = hash(payload);
  const mapping = await getSyncMap({
    sourceSystem: 'supabase',
    sourceTable: 'affiliates',
    sourceId: row.id,
    twentyObject: 'ambassador',
  });

  let ambassadorId = mapping?.twenty_record_id ?? null;
  let existingAmbassador = null;
  let action = 'skipped';

  if (ambassadorId) {
    const r = await twenty.query(
      `select id, "deletedAt" from ${tableRef(AMBASSADOR_TABLE)} where id=$1`,
      [ambassadorId],
    );
    existingAmbassador = r.rows[0] ?? null;
    if (!existingAmbassador) ambassadorId = null;
  }

  if (!ambassadorId) {
    existingAmbassador =
      (await findRecordByColumn(AMBASSADOR_TABLE, 'supabaseId', row.id)) ??
      (await findRecordByColumn(AMBASSADOR_TABLE, 'ambassadorCode', row.tracking_code)) ??
      (await findRecordByEmail(AMBASSADOR_TABLE, row.email));
    ambassadorId = existingAmbassador?.id ?? null;
  }

  if (!ambassadorId) {
    if (DRY_RUN) {
      ambassadorId = `dryrun:ambassador:${row.id}`;
    } else {
      ambassadorId = await insertRecord(
        AMBASSADOR_TABLE,
        ambassadorValuesFromPayload(payload),
      );
    }
    action = 'inserted';
  } else if (
    mapping?.content_hash === contentHash &&
    existingAmbassador?.deletedAt == null
  ) {
    action = 'skipped';
  } else {
    if (!DRY_RUN) {
      await updateRecord(
        AMBASSADOR_TABLE,
        ambassadorId,
        ambassadorValuesFromPayload(payload),
      );
    }
    action = 'updated';
  }

  if (!DRY_RUN) {
    await upsertSyncMap({
      sourceSystem: 'supabase',
      sourceTable: 'affiliates',
      sourceId: row.id,
      twentyObject: 'ambassador',
      twentyId: ambassadorId,
      contentHash,
      payload,
    });
  }

  return { action, id: ambassadorId };
};

const linkAmbassadorSponsors = async (affiliateRows, ambassadorIdBySourceId) => {
  const columns = await getTableColumns(AMBASSADOR_TABLE);
  if (!columns.has('sponsorId')) {
    log('sponsor linking skipped: ambassador.sponsorId relation column is missing');
    return;
  }

  for (const row of affiliateRows) {
    if (!row.parent_id) continue;

    stats.sponsorLinks.read += 1;

    const childId =
      ambassadorIdBySourceId.get(String(row.id)) ??
      (
        await getSyncMap({
          sourceSystem: 'supabase',
          sourceTable: 'affiliates',
          sourceId: row.id,
          twentyObject: 'ambassador',
        })
      )?.twenty_record_id;
    const sponsorId =
      ambassadorIdBySourceId.get(String(row.parent_id)) ??
      (
        await getSyncMap({
          sourceSystem: 'supabase',
          sourceTable: 'affiliates',
          sourceId: row.parent_id,
          twentyObject: 'ambassador',
        })
      )?.twenty_record_id;

    if (!childId || !sponsorId) {
      stats.sponsorLinks.missing += 1;
      log(`sponsor link missing ${row.email}: parent_id=${row.parent_id}`);
      continue;
    }

    if (DRY_RUN) {
      const existing = await twenty.query(
        `select "sponsorId"
           from ${tableRef(AMBASSADOR_TABLE)}
          where id = $1
          limit 1`,
        [childId],
      );

      if (existing.rows[0]?.sponsorId === sponsorId) {
        stats.sponsorLinks.skipped += 1;
      } else {
        stats.sponsorLinks.linked += 1;
      }

      continue;
    }

    const { rowCount } = await twenty.query(
      `update ${tableRef(AMBASSADOR_TABLE)}
          set "sponsorId" = $2,
              "updatedAt" = now()
        where id = $1
          and "sponsorId" is distinct from $2`,
      [childId, sponsorId],
    );

    if (rowCount > 0) {
      stats.sponsorLinks.linked += 1;
    } else {
      stats.sponsorLinks.skipped += 1;
    }
  }
};

// 1) Affiliates → Twenty people (tagged "Ambassador")
{
  const rows = await listAffiliates();
  stats.affiliates.read = rows.length;
  stats.ambassadors.read = rows.length;
  const ambassadorIdBySourceId = new Map();

  for (const row of rows) {
    const { first, last } = splitName(row.name);
    const payload = {
      firstName: first,
      lastName: last,
      email: row.email,
      trackingCode: row.tracking_code,
      status: row.status,
    };
    const personResult = await upsertPerson({
      sourceSystem: 'supabase',
      sourceTable: 'affiliates',
      sourceId: row.id,
      payload,
      jobTitle: 'Ambassador',
    });
    stats.affiliates[personResult.action] += 1;

    const ambassadorResult = await upsertAmbassador({
      row,
      personId: personResult.id,
    });
    stats.ambassadors[ambassadorResult.action] += 1;
    ambassadorIdBySourceId.set(String(row.id), ambassadorResult.id);

    log(
      `affiliate ${row.email} -> person:${personResult.action} ambassador:${ambassadorResult.action}`,
    );
  }

  await linkAmbassadorSponsors(rows, ambassadorIdBySourceId);
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
    const result = await upsertPerson({
      sourceSystem: 'supabase',
      sourceTable: 'orders',
      sourceId: row.user_email.toLowerCase(),
      payload,
      jobTitle: 'Customer',
    });
    stats.customers[result.action] += 1;
    log(`customer ${row.user_email} -> ${result.action}`);
  }
}

log('done');
console.table(stats);

if (supabasePg) {
  await supabasePg.end();
}
await twenty.end();
