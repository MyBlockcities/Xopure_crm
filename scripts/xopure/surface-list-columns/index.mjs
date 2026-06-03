// Surface useful columns on the XO Pure object TABLE views so lists read cleanly
// (e.g. orders show Customer/Status/Retail/Ordered At; customers/ambassadors show
// email + key fields). These same views drive the dashboard record-table widgets.
//
// Twenty 2.x does not expose a create-view-field GraphQL mutation, so this inserts
// core.viewField rows directly. Idempotent (skips fields already on a view).
// Views are fetched live, so a hard refresh surfaces the columns; if a workspace
// caches views, bump core.workspace.metadataVersion or restart to refresh.
//
// Env:
//   TWENTY_PG_URL   Twenty (Railway) Postgres connection string

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require(require.resolve('pg', { paths: [process.cwd(), process.cwd() + '/scripts/xopure/sync-supabase-to-twenty', process.cwd() + '/packages/twenty-server'] }));

const PG = process.env.TWENTY_PG_URL;
if (!PG) { console.error('Missing TWENTY_PG_URL'); process.exit(1); }

const COLUMNS = {
  xoOrder: ['customer', 'status', 'totalRetail', 'orderedAt'],
  customer: ['emails', 'subscriptionStatus', 'isActive', 'lifetimeSpend', 'orderCount', 'lastOrderAt', 'acquisitionSource'],
  ambassador: ['emails', 'status', 'paidAsRank', 'currentTier', 'groupCV', 'lifetimeEarnings', 'activeCustomerCount', 'enrolledAt'],
  product: ['sku', 'cvAmount', 'commissionEligible'],
};

const c = new Client({ connectionString: PG });
await c.connect();
const ws = (await c.query(`select id from core.workspace order by "createdAt" limit 1`)).rows[0].id;
const app = (await c.query(`select "applicationId" from core."viewField" where "applicationId" is not null limit 1`)).rows[0]?.applicationId;
for (const [obj, fields] of Object.entries(COLUMNS)) {
  let pos = 0.1;
  for (const fname of fields) {
    const r = await c.query(
      `insert into core."viewField"(id,"universalIdentifier","fieldMetadataId","isVisible",size,position,"viewId","workspaceId","createdAt","updatedAt","applicationId","isActive")
       select gen_random_uuid(), gen_random_uuid(), fm.id, true, 150, $3, v.id, $4, now(), now(), $5, true
       from core.view v
       join core."objectMetadata" om on om.id=v."objectMetadataId" and om."nameSingular"=$1
       join core."fieldMetadata" fm on fm."objectMetadataId"=om.id and fm.name=$2
       where v.type='TABLE'
         and not exists (select 1 from core."viewField" vf2 where vf2."viewId"=v.id and vf2."fieldMetadataId"=fm.id)`,
      [obj, fname, pos, ws, app]);
    if (r.rowCount) console.log(`+ ${obj}.${fname} -> ${r.rowCount} table view(s)`);
    pos += 0.1;
  }
}
await c.end();
console.log('done.');
