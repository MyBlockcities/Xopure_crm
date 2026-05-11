// Sync ambassadors (affiliates) and customers from the XO Pure Supabase
// project into the Twenty CRM workspace. Idempotent: tracks state in
// public.crm_sync_map on the Supabase side, keyed by source_id.
//
// Env required:
//   SUPABASE_PG_URL          Supabase Postgres connection string (CONNECTION_STRING in repo .env)
//   TWENTY_PG_URL            Twenty (Railway) Postgres connection string (DATABASE_PUBLIC_URL)
//   TWENTY_WORKSPACE_SCHEMA  e.g. workspace_5pedu4dl120j0zsebvp6nap5w
//
// Optional env:
//   DRY_RUN=1                Read + plan, no writes
//   IMPORTED_BY_NAME         createdByName tag for imported records (default: "Supabase Sync")

import crypto from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

const SUPABASE_PG_URL = process.env.SUPABASE_PG_URL;
const TWENTY_PG_URL = process.env.TWENTY_PG_URL;
const WS = process.env.TWENTY_WORKSPACE_SCHEMA;
const DRY_RUN = process.env.DRY_RUN === '1';
const IMPORTED_BY_NAME = process.env.IMPORTED_BY_NAME ?? 'Supabase Sync';

if (!SUPABASE_PG_URL || !TWENTY_PG_URL || !WS) {
  console.error(
    'Missing env. Need SUPABASE_PG_URL, TWENTY_PG_URL, TWENTY_WORKSPACE_SCHEMA.',
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

const supabase = new Client({ connectionString: SUPABASE_PG_URL });
const twenty = new Client({
  connectionString: TWENTY_PG_URL,
  ssl: { rejectUnauthorized: false },
});

await supabase.connect();
await twenty.connect();
log(`connected. dry_run=${DRY_RUN} workspace=${WS}`);

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

  const mapRes = await supabase.query(
    `select twenty_record_id, content_hash from public.crm_sync_map
     where source_system=$1 and source_table=$2 and source_id=$3
       and twenty_object='person'`,
    [sourceSystem, sourceTable, sourceId],
  );

  const mapping = mapRes.rows[0];
  let twentyId = mapping?.twenty_record_id ?? null;
  let action = 'skipped';

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
      `select id from "${WS}".person
       where lower("emailsPrimaryEmail") = lower($1)
         and "deletedAt" is null
       limit 1`,
      [payload.email],
    );
    if (r.rows[0]) twentyId = r.rows[0].id;
  }

  if (!twentyId) {
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
                "jobTitle" = coalesce(nullif($5,''), "jobTitle"),
                "deletedAt" = null,
                "updatedAt" = now()
          where id = $1`,
        [
          twentyId,
          payload.firstName,
          payload.lastName,
          payload.email ?? '',
          jobTitle ?? '',
        ],
      );
    }
    action = 'updated';
  }

  if (!DRY_RUN) {
    await supabase.query(
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
  }

  return action;
};

// 1) Affiliates → Twenty people (tagged "Ambassador")
{
  const { rows } = await supabase.query(
    `select id, email, name, tracking_code, status, created_at
       from public.affiliates
      order by created_at`,
  );
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
  const { rows } = await supabase.query(
    `select distinct on (lower(user_email))
            user_email,
            min(created_at) over (partition by lower(user_email)) as first_seen
       from public.orders
      where user_email is not null and length(user_email) > 0`,
  );
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

await supabase.end();
await twenty.end();
