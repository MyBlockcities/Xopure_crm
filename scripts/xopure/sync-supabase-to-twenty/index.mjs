
// Sync products, ambassadors (affiliates), customers, periods, and orders from
// the XO Pure Supabase project into the Twenty CRM workspace. Existing
// public.crm_sync_map rows are read for compatibility when available. The map
// is optional and read-only: this script never mutates Supabase.
//
// Env required:
//   VITE_SUPABASE_URL        Supabase REST URL
//   SUPABASE_SERVICE_ROLE_KEY Supabase service role key for REST reads
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
const PRODUCT_TABLE = '_product';
const PERIOD_TABLE = '_period';
const AMBASSADOR_TABLE = '_ambassador';
const CUSTOMER_TABLE = '_customer';
const ORDER_TABLE = '_xoOrder';

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

const shortHash = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 10);

const log = (...args) => console.log('[sync]', ...args);
const isDryRunId = (value) =>
  typeof value === 'string' && value.startsWith('dryrun:');
let canReadSyncMap = true;

const isMissingSyncMapError = (error) =>
  error?.code === '42P01' ||
  (error?.status === 404 &&
    String(error?.body).includes("public.crm_sync_map"));

const readSyncMap = async (reader) => {
  if (!canReadSyncMap) return undefined;

  try {
    return await reader();
  } catch (error) {
    if (!isMissingSyncMapError(error)) throw error;

    canReadSyncMap = false;
    log(
      'public.crm_sync_map is unavailable; continuing with Twenty-side stable-key lookups',
    );
    return undefined;
  }
};

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

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

const addDaysIso = (isoDate, days) => {
  if (!isoDate) return undefined;

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return undefined;

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

const toMonthCode = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return undefined;

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthStartIso = (periodCode) => `${periodCode}-01`;

const monthEndIso = (periodCode) => {
  const [year, month] = periodCode.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0));

  return end.toISOString().slice(0, 10);
};

const directAffiliateIdFromOrder = (order) =>
  Array.isArray(order.affiliate_chain) && order.affiliate_chain.length > 0
    ? order.affiliate_chain[0]
    : null;

const orderQuantity = (order) =>
  Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
    : 0;

const singleProductIdFromOrder = (order) => {
  if (!Array.isArray(order.items)) return null;

  const productIds = [
    ...new Set(
      order.items
        .map((item) => item.product_id)
        .filter((productId) => productId !== undefined && productId !== null),
    ),
  ];

  return productIds.length === 1 ? productIds[0] : null;
};

const orderCvCents = (order) =>
  order.cv_amount === null || order.cv_amount === undefined
    ? 0
    : Number(order.cv_amount);

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

const mapProductCategory = (product) => {
  const text = normalizeSelectValue(
    `${product.category ?? ''} ${product.name ?? ''} ${product.sku ?? ''}`,
  );

  if (text.includes('NAD')) return 'NAD';
  if (text.includes('METALEAN')) return 'METALEAN';
  if (text.includes('BPC') || text.includes('TB_500') || text.includes('TB500')) {
    return 'BPC_TB500';
  }
  if (text.includes('KLOW')) return 'KLOW';

  return 'OTHER';
};

const mapProductFormat = (product) => {
  const text = normalizeSelectValue(
    `${product.category ?? ''} ${product.name ?? ''} ${product.sku ?? ''}`,
  );

  return text.includes('STRIP') ? 'ORAL_STRIP' : 'OTHER';
};

const mapOrderStatus = (paymentStatus) => {
  const normalized = normalizeSelectValue(paymentStatus);

  if (['PAID', 'SUCCEEDED', 'SUCCESS', 'COMPLETED', 'CAPTURED'].includes(normalized)) {
    return 'PAID';
  }
  if (normalized.includes('SHIP')) return 'SHIPPED';
  if (normalized.includes('DELIVER')) return 'DELIVERED';
  if (normalized.includes('REFUND')) return 'REFUNDED';
  if (normalized.includes('CHARGEBACK') || normalized.includes('DISPUTE')) {
    return 'CHARGEBACK';
  }

  return 'PENDING';
};

const mapPaymentMethod = (paymentGateway) => {
  const normalized = normalizeSelectValue(paymentGateway);

  if (normalized === 'STRIPE') return 'STRIPE';
  if (normalized === 'PAYPAL') return 'PAYPAL';

  return undefined;
};

const twenty = new Client({
  connectionString: TWENTY_PG_URL,
  ssl: { rejectUnauthorized: false },
});

const supabasePg =
  SUPABASE_SYNC_SOURCE === 'pg'
    ? new Client({
        connectionString: SUPABASE_PG_URL,
        options: '-c default_transaction_read_only=on',
      })
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
    // Twenty 2.x added a required `updatedBy` actor composite (NOT NULL).
    // filterExistingColumns drops these on older schemas that lack them.
    updatedBySource: values.updatedBySource ?? 'IMPORT',
    updatedByName: values.updatedByName ?? IMPORTED_BY_NAME,
    updatedByWorkspaceMemberId: values.updatedByWorkspaceMemberId ?? null,
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
  if (method !== 'GET') {
    throw new Error(
      `Blocked Supabase REST ${method}: Supabase is an absolute read-only source.`,
    );
  }

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
    return await readSyncMap(async () => {
      const mapRes = await supabasePg.query(
        `select twenty_record_id, content_hash from public.crm_sync_map
         where source_system=$1 and source_table=$2 and source_id=$3
           and twenty_object=$4`,
        [sourceSystem, sourceTable, sourceId, twentyObject],
      );

      return mapRes.rows[0];
    });
  }

  return await readSyncMap(async () => {
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
  });
};

const getSyncMapByTwentyId = async ({ twentyObject = 'person', twentyId }) => {
  if (supabasePg) {
    return await readSyncMap(async () => {
      const mapRes = await supabasePg.query(
        `select source_system, source_schema, source_table, source_id
           from public.crm_sync_map
          where twenty_object=$1 and twenty_record_id=$2
          limit 1`,
        [twentyObject, twentyId],
      );

      return mapRes.rows[0];
    });
  }

  return await readSyncMap(async () => {
    const rows = await supabaseRest('crm_sync_map', {
      params: {
        select: 'source_system,source_schema,source_table,source_id',
        twenty_object: `eq.${twentyObject}`,
        twenty_record_id: `eq.${twentyId}`,
        limit: 1,
      },
    });

    return rows[0];
  });
};

const upsertSyncMap = async ({
  sourceTable,
  twentyObject = 'person',
}) => {
  log(
    `- skipped Supabase crm_sync_map write for ${sourceTable} -> ${twentyObject}; Supabase is read-only`,
  );
};

const listAffiliates = async () => {
  if (supabasePg) {
    const { rows } = await supabasePg.query(
      `select id, email, name, tracking_code, parent_id, status, account_type,
              active_customer_count, personal_volume_cents, team_volume_cents,
              career_rank, paid_as_rank, rank, created_at
         from public.affiliates
        order by created_at`,
    );
    return rows;
  }

  return await supabaseRest('affiliates', {
    params: {
      select:
        'id,email,name,tracking_code,parent_id,status,account_type,active_customer_count,personal_volume_cents,team_volume_cents,career_rank,paid_as_rank,rank,created_at',
      order: 'created_at.asc',
    },
  });
};

const listProducts = async () => {
  if (supabasePg) {
    const { rows } = await supabasePg.query(
      `select id, sku, name, description, price_cents, currency, category,
              active, metadata, cv_amount_cents, created_at, updated_at
         from public.products
        order by created_at`,
    );
    return rows;
  }

  return await supabaseRest('products', {
    params: {
      select:
        'id,sku,name,description,price_cents,currency,category,active,metadata,cv_amount_cents,created_at,updated_at',
      order: 'created_at.asc',
    },
  });
};

const listOrders = async () => {
  if (supabasePg) {
    const { rows } = await supabasePg.query(
      `select id, user_email, subtotal_cents, total_cents, currency,
              affiliate_chain, payment_gateway, payment_status, gateway_payload,
              shipping_address, items, cv_amount, created_at
         from public.orders
        where user_email is not null and length(user_email) > 0
        order by created_at`,
    );
    return rows;
  }

  return await supabaseRest('orders', {
    params: {
      select:
        'id,user_email,subtotal_cents,total_cents,currency,affiliate_chain,payment_gateway,payment_status,gateway_payload,shipping_address,items,cv_amount,created_at',
      user_email: 'not.is.null',
      order: 'created_at.asc',
    },
  });
};

const buildCustomerSummaries = (orders) => {
  const byEmail = new Map();

  for (const order of orders) {
    const email = normalizeEmail(order.user_email);
    if (!email) continue;

    const shipping = order.shipping_address ?? {};
    const existing = byEmail.get(email) ?? {
      sourceId: email,
      email,
      firstName: '',
      lastName: '',
      phone: '',
      firstOrderAt: order.created_at,
      lastOrderAt: order.created_at,
      lifetimeSpendCents: 0,
      lifetimeCVCents: 0,
      orderCount: 0,
      shippingAddress: {},
      referrerAffiliateId: null,
    };

    existing.orderCount += 1;
    existing.lifetimeSpendCents += Number(order.total_cents ?? 0);
    existing.lifetimeCVCents += orderCvCents(order);

    if (!existing.firstOrderAt || order.created_at < existing.firstOrderAt) {
      existing.firstOrderAt = order.created_at;
    }

    if (!existing.lastOrderAt || order.created_at >= existing.lastOrderAt) {
      existing.lastOrderAt = order.created_at;
      existing.firstName = shipping.first_name ?? existing.firstName;
      existing.lastName = shipping.last_name ?? existing.lastName;
      existing.phone = shipping.phone ?? existing.phone;
      existing.shippingAddress = shipping;
    }

    existing.referrerAffiliateId =
      existing.referrerAffiliateId ?? directAffiliateIdFromOrder(order);

    byEmail.set(email, existing);
  }

  return [...byEmail.values()];
};

const buildPeriodSummaries = (orders) => {
  const byCode = new Map();

  for (const order of orders) {
    const periodCode = toMonthCode(order.created_at);
    if (!periodCode) continue;

    const existing = byCode.get(periodCode) ?? {
      periodCode,
      totalRetailCents: 0,
      totalCVCents: 0,
    };

    existing.totalRetailCents += Number(order.total_cents ?? 0);
    existing.totalCVCents += orderCvCents(order);
    byCode.set(periodCode, existing);
  }

  return [...byCode.values()].sort((a, b) =>
    a.periodCode.localeCompare(b.periodCode),
  );
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
  products: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  affiliates: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  ambassadors: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  sponsorLinks: { read: 0, linked: 0, skipped: 0, missing: 0 },
  customerPeople: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  customerProfiles: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  periods: { read: 0, inserted: 0, updated: 0, skipped: 0 },
  orders: { read: 0, inserted: 0, updated: 0, skipped: 0 },
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
           position,"createdBySource","createdByName","createdByWorkspaceMemberId",
           "updatedBySource","updatedByName","updatedByWorkspaceMemberId","createdAt","updatedAt")
         values ($1,$2,$3,$4,$5,'IMPORT',$6,null,'IMPORT',$6,null,now(),now())
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
  name:
    [payload.firstName, payload.lastName].filter(Boolean).join(' ') ||
    payload.email ||
    payload.ambassadorCode,
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
      if (isDryRunId(childId) || isDryRunId(sponsorId)) {
        stats.sponsorLinks.linked += 1;
        continue;
      }

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

const upsertProduct = async (row) => {
  await assertTableExists(PRODUCT_TABLE, 'Run the custom object setup first.');

  const payload = {
    supabaseId: row.id,
    sku: row.sku,
    name: row.name,
    category: mapProductCategory(row),
    format: mapProductFormat(row),
    retailPriceMicros: centsToAmountMicros(row.price_cents),
    cvAmountMicros: centsToAmountMicros(
      row.cv_amount_cents ?? Math.round(Number(row.price_cents ?? 0) * 0.5),
    ),
    currency: row.currency ?? DEFAULT_CURRENCY_CODE,
    stripePriceId:
      row.metadata?.stripe_price_id ??
      row.metadata?.stripePriceId ??
      row.metadata?.stripe_price ??
      undefined,
    safeDescription: row.description,
    isActive: row.active ?? true,
    commissionEligible: row.active !== false,
  };
  const contentHash = hash(payload);
  const mapping = await getSyncMap({
    sourceSystem: 'supabase',
    sourceTable: 'products',
    sourceId: row.id,
    twentyObject: 'product',
  });

  let productId = mapping?.twenty_record_id ?? null;
  let existingProduct = null;
  let action = 'skipped';

  if (productId) {
    const r = await twenty.query(
      `select id, "deletedAt" from ${tableRef(PRODUCT_TABLE)} where id=$1`,
      [productId],
    );
    existingProduct = r.rows[0] ?? null;
    if (!existingProduct) productId = null;
  }

  if (!productId) {
    existingProduct =
      (await findRecordByColumn(PRODUCT_TABLE, 'supabaseId', row.id)) ??
      (await findRecordByColumn(PRODUCT_TABLE, 'sku', row.sku));
    productId = existingProduct?.id ?? null;
  }

  const values = {
    name: payload.name,
    supabaseId: payload.supabaseId,
    sku: payload.sku,
    category: payload.category,
    format: payload.format,
    retailPriceAmountMicros: payload.retailPriceMicros,
    retailPriceCurrencyCode: payload.currency,
    cvAmountAmountMicros: payload.cvAmountMicros,
    cvAmountCurrencyCode: payload.currency,
    stripePriceId: payload.stripePriceId,
    safeDescription: payload.safeDescription,
    isActive: payload.isActive,
    commissionEligible: payload.commissionEligible,
  };

  if (!productId) {
    if (DRY_RUN) {
      productId = `dryrun:product:${row.id}`;
    } else {
      productId = await insertRecord(PRODUCT_TABLE, values);
    }
    action = 'inserted';
  } else if (mapping?.content_hash === contentHash && existingProduct?.deletedAt == null) {
    action = 'skipped';
  } else {
    if (!DRY_RUN) {
      await updateRecord(PRODUCT_TABLE, productId, values);
    }
    action = 'updated';
  }

  if (!DRY_RUN) {
    await upsertSyncMap({
      sourceSystem: 'supabase',
      sourceTable: 'products',
      sourceId: row.id,
      twentyObject: 'product',
      twentyId: productId,
      contentHash,
      payload,
    });
  }

  return { action, id: productId };
};

const upsertPeriod = async (summary) => {
  await assertTableExists(PERIOD_TABLE, 'Run the custom object setup first.');

  // status is admin-owned in Twenty (OPEN/CLOSED/FROZEN) — set on insert only,
  // never overwrite on update. Keep it out of the payload that feeds contentHash
  // so order-total changes don't drag status back to OPEN.
  const payload = {
    periodCode: summary.periodCode,
    startDate: monthStartIso(summary.periodCode),
    endDate: monthEndIso(summary.periodCode),
    totalRetailMicros: centsToAmountMicros(summary.totalRetailCents),
    totalCVMicros: centsToAmountMicros(summary.totalCVCents),
    currency: DEFAULT_CURRENCY_CODE,
  };
  const contentHash = hash(payload);
  const mapping = await getSyncMap({
    sourceSystem: 'supabase',
    sourceTable: 'order_periods',
    sourceId: summary.periodCode,
    twentyObject: 'period',
  });

  let periodId = mapping?.twenty_record_id ?? null;
  let existingPeriod = null;
  let action = 'skipped';

  if (periodId) {
    const r = await twenty.query(
      `select id, "deletedAt" from ${tableRef(PERIOD_TABLE)} where id=$1`,
      [periodId],
    );
    existingPeriod = r.rows[0] ?? null;
    if (!existingPeriod) periodId = null;
  }

  if (!periodId) {
    existingPeriod = await findRecordByColumn(
      PERIOD_TABLE,
      'periodCode',
      summary.periodCode,
    );
    periodId = existingPeriod?.id ?? null;
  }

  const updateValues = {
    name: payload.periodCode,
    periodCode: payload.periodCode,
    startDate: payload.startDate,
    endDate: payload.endDate,
    totalRetailAmountMicros: payload.totalRetailMicros,
    totalRetailCurrencyCode: payload.currency,
    totalCVAmountMicros: payload.totalCVMicros,
    totalCVCurrencyCode: payload.currency,
  };

  if (!periodId) {
    if (DRY_RUN) {
      periodId = `dryrun:period:${summary.periodCode}`;
    } else {
      periodId = await insertRecord(PERIOD_TABLE, { ...updateValues, status: 'OPEN' });
    }
    action = 'inserted';
  } else if (mapping?.content_hash === contentHash && existingPeriod?.deletedAt == null) {
    action = 'skipped';
  } else {
    if (!DRY_RUN) {
      await updateRecord(PERIOD_TABLE, periodId, updateValues);
    }
    action = 'updated';
  }

  if (!DRY_RUN) {
    await upsertSyncMap({
      sourceSystem: 'supabase',
      sourceTable: 'order_periods',
      sourceId: summary.periodCode,
      twentyObject: 'period',
      twentyId: periodId,
      contentHash,
      payload,
    });
  }

  return { action, id: periodId };
};

const buildCustomerValues = (payload) => ({
  name:
    [payload.firstName, payload.lastName].filter(Boolean).join(' ') ||
    payload.email,
  customerCode: payload.customerCode,
  fullNameFirstName: payload.firstName,
  fullNameLastName: payload.lastName,
  emailsPrimaryEmail: payload.email,
  phonesPrimaryPhoneNumber: payload.phone,
  phonesPrimaryPhoneCountryCode: payload.phone ? 'US' : undefined,
  shippingAddressAddressStreet1: payload.shippingAddress.address,
  shippingAddressAddressCity: payload.shippingAddress.city,
  shippingAddressAddressPostcode: payload.shippingAddress.zip,
  shippingAddressAddressState: payload.shippingAddress.state,
  shippingAddressAddressCountry: payload.shippingAddress.country ?? 'US',
  enrolledAt: payload.firstOrderAt,
  isActive: payload.isActive,
  lifetimeCVAmountMicros: payload.lifetimeCVMicros,
  lifetimeCVCurrencyCode: payload.currency,
  lifetimeSpendAmountMicros: payload.lifetimeSpendMicros,
  lifetimeSpendCurrencyCode: payload.currency,
  lastOrderAt: payload.lastOrderAt,
  orderCount: payload.orderCount,
  subscriptionStatus: 'NONE',
  acquisitionSource: payload.referrerId ? 'REFERRAL' : 'DIRECT_LINK',
  referrerId: payload.referrerId,
  personId: payload.personId,
});

const upsertCustomerProfile = async ({ summary, personId, referrerId }) => {
  await assertTableExists(CUSTOMER_TABLE, 'Run the custom object setup first.');

  const payload = {
    customerCode: `CUST-${shortHash(summary.email).toUpperCase()}`,
    firstName: summary.firstName,
    lastName: summary.lastName,
    email: summary.email,
    phone: summary.phone,
    firstOrderAt: summary.firstOrderAt,
    lastOrderAt: summary.lastOrderAt,
    orderCount: summary.orderCount,
    lifetimeSpendMicros: centsToAmountMicros(summary.lifetimeSpendCents),
    lifetimeCVMicros: centsToAmountMicros(summary.lifetimeCVCents),
    currency: DEFAULT_CURRENCY_CODE,
    isActive:
      summary.lastOrderAt &&
      Date.now() - new Date(summary.lastOrderAt).getTime() <=
        60 * 24 * 60 * 60 * 1000,
    shippingAddress: summary.shippingAddress ?? {},
    referrerId,
    personId,
  };
  const contentHash = hash(payload);
  const mapping = await getSyncMap({
    sourceSystem: 'supabase',
    sourceTable: 'order_customers',
    sourceId: summary.sourceId,
    twentyObject: 'customer',
  });

  let customerId = mapping?.twenty_record_id ?? null;
  let existingCustomer = null;
  let action = 'skipped';

  if (customerId) {
    const r = await twenty.query(
      `select id, "deletedAt" from ${tableRef(CUSTOMER_TABLE)} where id=$1`,
      [customerId],
    );
    existingCustomer = r.rows[0] ?? null;
    if (!existingCustomer) customerId = null;
  }

  if (!customerId) {
    existingCustomer =
      (await findRecordByColumn(CUSTOMER_TABLE, 'customerCode', payload.customerCode)) ??
      (await findRecordByEmail(CUSTOMER_TABLE, payload.email));
    customerId = existingCustomer?.id ?? null;
  }

  const values = buildCustomerValues(payload);

  if (!customerId) {
    if (DRY_RUN) {
      customerId = `dryrun:customer:${summary.sourceId}`;
    } else {
      customerId = await insertRecord(CUSTOMER_TABLE, values);
    }
    action = 'inserted';
  } else if (mapping?.content_hash === contentHash && existingCustomer?.deletedAt == null) {
    action = 'skipped';
  } else {
    if (!DRY_RUN) {
      await updateRecord(CUSTOMER_TABLE, customerId, values);
    }
    action = 'updated';
  }

  if (!DRY_RUN) {
    await upsertSyncMap({
      sourceSystem: 'supabase',
      sourceTable: 'order_customers',
      sourceId: summary.sourceId,
      twentyObject: 'customer',
      twentyId: customerId,
      contentHash,
      payload,
    });
  }

  return { action, id: customerId };
};

const buildOrderValues = (payload) => ({
  name: payload.orderCode,
  supabaseId: payload.supabaseId,
  orderCode: payload.orderCode,
  orderedAt: payload.orderedAt,
  settledAt: payload.settledAt,
  status: payload.status,
  quantity: payload.quantity,
  unitPriceAmountMicros: payload.unitPriceMicros,
  unitPriceCurrencyCode:
    payload.unitPriceMicros === undefined ? undefined : payload.currency,
  totalRetailAmountMicros: payload.totalRetailMicros,
  totalRetailCurrencyCode: payload.currency,
  totalCVAmountMicros: payload.totalCVMicros,
  totalCVCurrencyCode: payload.currency,
  paymentMethod: payload.paymentMethod,
  stripePaymentIntentId: payload.stripePaymentIntentId,
  paypalCaptureId: payload.paypalCaptureId,
  isPersonalOrder: payload.isPersonalOrder,
  discountCode: payload.discountCode,
  referringAmbassadorId: payload.referringAmbassadorId,
  customerId: payload.customerId,
  productId: payload.productId,
  periodId: payload.periodId,
});

const upsertOrderRecord = async ({
  row,
  customerId,
  referringAmbassadorId,
  productId,
  periodId,
  affiliateById,
}) => {
  await assertTableExists(ORDER_TABLE, 'Run the custom object setup first.');

  const directAffiliateId = directAffiliateIdFromOrder(row);
  const directAffiliateEmail = directAffiliateId
    ? normalizeEmail(affiliateById.get(String(directAffiliateId))?.email)
    : '';
  const customerEmail = normalizeEmail(row.user_email);
  const quantity = orderQuantity(row);
  const unitPriceCents =
    quantity > 0 && row.subtotal_cents !== null && row.subtotal_cents !== undefined
      ? Math.round(Number(row.subtotal_cents) / quantity)
      : undefined;
  const currency = row.currency ?? DEFAULT_CURRENCY_CODE;
  const gatewayPayload = row.gateway_payload ?? {};

  const payload = {
    supabaseId: row.id,
    orderCode: `ORD-${String(row.id).slice(0, 8).toUpperCase()}`,
    orderedAt: row.created_at,
    settledAt: addDaysIso(row.created_at, 7),
    status: mapOrderStatus(row.payment_status),
    quantity,
    unitPriceMicros: centsToAmountMicros(unitPriceCents),
    totalRetailMicros: centsToAmountMicros(row.total_cents),
    totalCVMicros: centsToAmountMicros(orderCvCents(row)),
    currency,
    paymentMethod: mapPaymentMethod(row.payment_gateway),
    stripePaymentIntentId:
      gatewayPayload.payment_intent ??
      gatewayPayload.paymentIntentId ??
      gatewayPayload.stripe_payment_intent_id,
    paypalCaptureId:
      gatewayPayload.paypal_capture_id ??
      gatewayPayload.paypalCaptureId ??
      gatewayPayload.capture_id,
    isPersonalOrder:
      Boolean(directAffiliateEmail) && directAffiliateEmail === customerEmail,
    discountCode: row.discount_code_id ? String(row.discount_code_id) : undefined,
    referringAmbassadorId,
    customerId,
    productId,
    periodId,
  };
  const contentHash = hash(payload);
  const mapping = await getSyncMap({
    sourceSystem: 'supabase',
    sourceTable: 'orders',
    sourceId: row.id,
    twentyObject: 'xoOrder',
  });

  let orderId = mapping?.twenty_record_id ?? null;
  let existingOrder = null;
  let action = 'skipped';

  if (orderId) {
    const r = await twenty.query(
      `select id, "deletedAt" from ${tableRef(ORDER_TABLE)} where id=$1`,
      [orderId],
    );
    existingOrder = r.rows[0] ?? null;
    if (!existingOrder) orderId = null;
  }

  if (!orderId) {
    existingOrder =
      (await findRecordByColumn(ORDER_TABLE, 'supabaseId', row.id)) ??
      (await findRecordByColumn(ORDER_TABLE, 'orderCode', payload.orderCode));
    orderId = existingOrder?.id ?? null;
  }

  const values = buildOrderValues(payload);

  if (!orderId) {
    if (DRY_RUN) {
      orderId = `dryrun:order:${row.id}`;
    } else {
      orderId = await insertRecord(ORDER_TABLE, values);
    }
    action = 'inserted';
  } else if (mapping?.content_hash === contentHash && existingOrder?.deletedAt == null) {
    action = 'skipped';
  } else {
    if (!DRY_RUN) {
      await updateRecord(ORDER_TABLE, orderId, values);
    }
    action = 'updated';
  }

  if (!DRY_RUN) {
    await upsertSyncMap({
      sourceSystem: 'supabase',
      sourceTable: 'orders',
      sourceId: row.id,
      twentyObject: 'xoOrder',
      twentyId: orderId,
      contentHash,
      payload,
    });
  }

  return { action, id: orderId };
};

const productIdBySourceId = new Map();
const periodIdByCode = new Map();
const ambassadorIdBySourceId = new Map();
const customerIdByEmail = new Map();

// 1) Products → Twenty Product catalog
{
  const rows = await listProducts();
  stats.products.read = rows.length;

  for (const row of rows) {
    const result = await upsertProduct(row);
    stats.products[result.action] += 1;
    productIdBySourceId.set(String(row.id), result.id);
    log(`product ${row.sku} -> ${result.action}`);
  }
}

// 2) Affiliates → Twenty people + Ambassador profiles
{
  const rows = await listAffiliates();
  stats.affiliates.read = rows.length;
  stats.ambassadors.read = rows.length;

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

const affiliateById = new Map(
  (await listAffiliates()).map((affiliate) => [String(affiliate.id), affiliate]),
);
const orderRows = await listOrders();

// 3) Order months → Twenty Periods
{
  const rows = buildPeriodSummaries(orderRows);
  stats.periods.read = rows.length;

  for (const row of rows) {
    const result = await upsertPeriod(row);
    stats.periods[result.action] += 1;
    periodIdByCode.set(row.periodCode, result.id);
    log(`period ${row.periodCode} -> ${result.action}`);
  }
}

// 4) Customers (distinct buyers from orders) → Twenty people + Customer profiles
{
  const rows = buildCustomerSummaries(orderRows);
  stats.customerPeople.read = rows.length;
  stats.customerProfiles.read = rows.length;

  for (const row of rows) {
    const payload = {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      firstOrderAt: row.firstOrderAt,
    };
    const personResult = await upsertPerson({
      sourceSystem: 'supabase',
      sourceTable: 'orders',
      sourceId: row.email,
      payload,
      jobTitle: 'Customer',
    });
    stats.customerPeople[personResult.action] += 1;

    const referrerId = row.referrerAffiliateId
      ? ambassadorIdBySourceId.get(String(row.referrerAffiliateId)) ??
        (
          await getSyncMap({
            sourceSystem: 'supabase',
            sourceTable: 'affiliates',
            sourceId: row.referrerAffiliateId,
            twentyObject: 'ambassador',
          })
        )?.twenty_record_id
      : null;

    const customerResult = await upsertCustomerProfile({
      summary: row,
      personId: personResult.id,
      referrerId,
    });
    stats.customerProfiles[customerResult.action] += 1;
    customerIdByEmail.set(row.email, customerResult.id);

    log(
      `customer ${row.email} -> person:${personResult.action} profile:${customerResult.action}`,
    );
  }
}

// 5) Orders → Twenty Orders linked to Customer, Ambassador, Product, Period
{
  stats.orders.read = orderRows.length;

  for (const row of orderRows) {
    const customerId = customerIdByEmail.get(normalizeEmail(row.user_email));
    const referringAmbassadorId = directAffiliateIdFromOrder(row)
      ? ambassadorIdBySourceId.get(String(directAffiliateIdFromOrder(row))) ??
        (
          await getSyncMap({
            sourceSystem: 'supabase',
            sourceTable: 'affiliates',
            sourceId: directAffiliateIdFromOrder(row),
            twentyObject: 'ambassador',
          })
        )?.twenty_record_id
      : null;
    const sourceProductId = singleProductIdFromOrder(row);
    const productId = sourceProductId
      ? productIdBySourceId.get(String(sourceProductId)) ??
        (
          await getSyncMap({
            sourceSystem: 'supabase',
            sourceTable: 'products',
            sourceId: sourceProductId,
            twentyObject: 'product',
          })
        )?.twenty_record_id
      : null;
    const periodCode = toMonthCode(row.created_at);
    const periodId = periodCode
      ? periodIdByCode.get(periodCode) ??
        (
          await getSyncMap({
            sourceSystem: 'supabase',
            sourceTable: 'order_periods',
            sourceId: periodCode,
            twentyObject: 'period',
          })
        )?.twenty_record_id
      : null;

    const result = await upsertOrderRecord({
      row,
      customerId,
      referringAmbassadorId,
      productId,
      periodId,
      affiliateById,
    });
    stats.orders[result.action] += 1;
    log(`order ${row.id} -> ${result.action}`);
  }
}

log('done');
console.table(stats);

if (supabasePg) {
  await supabasePg.end();
}
await twenty.end();
