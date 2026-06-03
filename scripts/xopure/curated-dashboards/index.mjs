// Build three curated XO Pure dashboards into a Twenty 2.x workspace:
//   - "XO Pure · Mission Control" — at-a-glance overview KPIs + trends + Recent Orders
//   - "Growth" — ambassador/customer growth, group CV, network mix
//   - "Oversight & Customer Service" — order ops / fulfillment status + customer health
//
// Curated from the legacy DashboardTemplates against the manual mirror model
// (ambassador / customer / xoOrder / period / product). Every widget is designed
// around fields confirmed to exist + be chartable, so there are no broken cards.
//
// Idempotent: updates the boards (matched by title) to the full widget set.
//
// Env:
//   TWENTY_SERVER_URL   e.g. https://crm.xopure.com
//   TWENTY_API_KEY      Admin API key for the target workspace

import { randomUUID } from 'crypto';

const SERVER = (process.env.TWENTY_SERVER_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.TWENTY_API_KEY ?? '';
if (!SERVER || !TOKEN) { console.error('Missing TWENTY_SERVER_URL or TWENTY_API_KEY'); process.exit(1); }

const gql = async (ep, q, v) => {
  const r = await fetch(SERVER + ep, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ query: q, variables: v }) });
  const j = await r.json(); if (j.errors) throw new Error(ep + ' :: ' + JSON.stringify(j.errors)); return j.data;
};
const meta = await gql('/metadata', `{ objects(paging:{first:200}){ edges{node{id nameSingular fields(paging:{first:500}){edges{node{id name}}}}} } }`);
const O = {}; for (const e of meta.objects.edges) { const o = e.node; O[o.nameSingular] = { id: o.id, f: Object.fromEntries(o.fields.edges.map(x => [x.node.name, x.node.id])) }; }
const oid = (n) => O[n]?.id, fid = (n, f) => O[n]?.f?.[f];

const G = (row, column, rowSpan, columnSpan) => ({ row, column, rowSpan, columnSpan });
const kpi = (title, obj, field, op, g) => ({ type: 'graph', visualization: 'aggregate', title, objectNameSingular: obj, aggregateFieldName: field, aggregateOperation: op, gridPosition: g });
const line = (title, obj, groupBy, g, field = 'id', op = 'COUNT') => ({ type: 'graph', visualization: 'line', title, objectNameSingular: obj, groupByFieldName: groupBy, aggregateFieldName: field, aggregateOperation: op, gridPosition: g });
const pie = (title, obj, groupBy, g) => ({ type: 'graph', visualization: 'pie', title, objectNameSingular: obj, groupByFieldName: groupBy, aggregateFieldName: 'id', aggregateOperation: 'COUNT', gridPosition: g });
const bar = (title, obj, groupBy, g, field = 'id', op = 'COUNT') => ({ type: 'graph', visualization: 'bar', title, objectNameSingular: obj, groupByFieldName: groupBy, aggregateFieldName: field, aggregateOperation: op, gridPosition: g });
const table = (title, obj, g) => ({ type: 'recordTable', title, objectNameSingular: obj, gridPosition: g });

const DASHBOARDS = [
  { name: 'XO Pure · Mission Control', tab: 'Overview', widgets: [
    kpi('Total Revenue', 'xoOrder', 'totalRetail', 'SUM', G(0, 0, 4, 3)), kpi('Total Orders', 'xoOrder', 'id', 'COUNT', G(0, 3, 4, 3)),
    kpi('Total Customers', 'customer', 'id', 'COUNT', G(0, 6, 4, 3)), kpi('Total Ambassadors', 'ambassador', 'id', 'COUNT', G(0, 9, 4, 3)),
    line('Revenue Over Time', 'xoOrder', 'orderedAt', G(4, 0, 6, 6), 'totalRetail', 'SUM'), line('Orders Over Time', 'xoOrder', 'orderedAt', G(4, 6, 6, 6)),
    pie('Orders by Status', 'xoOrder', 'status', G(10, 0, 6, 6)), bar('Ambassadors by Paid-As Rank', 'ambassador', 'paidAsRank', G(10, 6, 6, 6)),
    table('Recent Orders', 'xoOrder', G(16, 0, 6, 12)),
  ] },
  { name: 'Growth', tab: 'Growth', widgets: [
    kpi('Total Ambassadors', 'ambassador', 'id', 'COUNT', G(0, 0, 4, 3)), kpi('Total Customers', 'customer', 'id', 'COUNT', G(0, 3, 4, 3)),
    kpi('Total Orders', 'xoOrder', 'id', 'COUNT', G(0, 6, 4, 3)), kpi('Total Group CV', 'ambassador', 'groupCV', 'SUM', G(0, 9, 4, 3)),
    line('New Ambassadors Over Time', 'ambassador', 'enrolledAt', G(4, 0, 6, 6)), line('Customer Growth', 'customer', 'createdAt', G(4, 6, 6, 6)),
    line('Revenue Over Time', 'xoOrder', 'orderedAt', G(10, 0, 6, 6), 'totalRetail', 'SUM'), line('Orders Over Time', 'xoOrder', 'orderedAt', G(10, 6, 6, 6)),
    pie('Ambassadors by Status', 'ambassador', 'status', G(16, 0, 6, 4)), pie('Ambassadors by Path', 'ambassador', 'path', G(16, 4, 6, 4)), pie('Ambassadors by Onboarding Stage', 'ambassador', 'onboardingStage', G(16, 8, 6, 4)),
    table('Recent Ambassadors', 'ambassador', G(22, 0, 6, 12)),
  ] },
  { name: 'Oversight & Customer Service', tab: 'Operations', widgets: [
    kpi('Total Orders', 'xoOrder', 'id', 'COUNT', G(0, 0, 4, 3)), kpi('Avg Order Value', 'xoOrder', 'totalRetail', 'AVG', G(0, 3, 4, 3)),
    kpi('Total Units Sold', 'xoOrder', 'quantity', 'SUM', G(0, 6, 4, 3)), kpi('Total Customers', 'customer', 'id', 'COUNT', G(0, 9, 4, 3)),
    line('Orders Over Time', 'xoOrder', 'orderedAt', G(4, 0, 6, 6)), bar('Orders by Status (Fulfillment)', 'xoOrder', 'status', G(4, 6, 6, 6)),
    pie('Orders by Payment Method', 'xoOrder', 'paymentMethod', G(10, 0, 6, 4)), pie('Self-Referral (Personal) Share', 'xoOrder', 'isPersonalOrder', G(10, 4, 6, 4)), pie('Fraud-Flagged Orders', 'xoOrder', 'fraudFlagged', G(10, 8, 6, 4)),
    pie('Active vs Inactive Customers', 'customer', 'isActive', G(16, 0, 6, 4)), pie('Customers by Subscription', 'customer', 'subscriptionStatus', G(16, 4, 6, 4)), pie('Customers by Acquisition Source', 'customer', 'acquisitionSource', G(16, 8, 6, 4)),
    table('Recent Orders', 'xoOrder', G(22, 0, 6, 12)),
  ] },
];

const cfg = (w, gId, aId) => {
  const op = w.aggregateOperation ?? 'COUNT'; const vis = w.visualization;
  if (['bar', 'line', 'pie'].includes(vis) && !gId) return undefined; const g = gId ?? '';
  if (vis === 'bar') return { __typename: 'BarChartConfiguration', configurationType: 'BAR_CHART', layout: 'VERTICAL', displayDataLabel: true, displayLegend: true, color: 'auto', primaryAxisGroupByFieldMetadataId: g, aggregateFieldMetadataId: aId, aggregateOperation: op, primaryAxisOrderBy: 'FIELD_POSITION_ASC', axisNameDisplay: 'NONE' };
  if (vis === 'line') return { __typename: 'LineChartConfiguration', configurationType: 'LINE_CHART', displayDataLabel: true, displayLegend: true, color: 'auto', primaryAxisGroupByFieldMetadataId: g, aggregateFieldMetadataId: aId, aggregateOperation: op, primaryAxisOrderBy: 'FIELD_POSITION_ASC', axisNameDisplay: 'NONE' };
  if (vis === 'pie') return { __typename: 'PieChartConfiguration', configurationType: 'PIE_CHART', displayDataLabel: true, displayLegend: true, color: 'auto', groupByFieldMetadataId: g, aggregateFieldMetadataId: aId, aggregateOperation: op, orderBy: 'VALUE_DESC' };
  if (vis === 'aggregate') return { __typename: 'AggregateChartConfiguration', configurationType: 'AGGREGATE_CHART', displayDataLabel: true, aggregateFieldMetadataId: aId, aggregateOperation: op };
};
const build = (w, tabId, skip) => {
  const id = randomUUID(); const p = (gp) => ({ layoutMode: 'GRID', ...gp });
  if (w.type === 'recordTable') { const o = oid(w.objectNameSingular); if (!o) { skip.push(w.title); return null; } return { id, pageLayoutTabId: tabId, title: w.title, type: 'RECORD_TABLE', objectMetadataId: o, gridPosition: w.gridPosition, position: p(w.gridPosition), configuration: { __typename: 'RecordTableConfiguration', configurationType: 'RECORD_TABLE' }, conditionalAvailabilityExpression: null }; }
  const o = oid(w.objectNameSingular); if (!o) { skip.push(w.title); return null; }
  const gId = w.groupByFieldName ? fid(w.objectNameSingular, w.groupByFieldName) : undefined;
  const aId = fid(w.objectNameSingular, w.aggregateFieldName ?? 'id'); if (!aId) { skip.push(w.title); return null; }
  const configuration = cfg(w, gId, aId); if (!configuration) { skip.push(w.title); return null; }
  return { id, pageLayoutTabId: tabId, title: w.title, type: 'GRAPH', objectMetadataId: o, gridPosition: w.gridPosition, position: p(w.gridPosition), configuration, conditionalAvailabilityExpression: null };
};

const ex = await gql('/graphql', `query{ dashboards(first:500){ edges{node{id title pageLayoutId}} } }`);
const byTitle = new Map((ex.dashboards?.edges ?? []).map(e => [e.node.title, e.node]));
for (const d of DASHBOARDS) {
  const skip = []; let plId = byTitle.get(d.name)?.pageLayoutId;
  if (!plId) { const c = await gql('/graphql', `mutation($data:DashboardCreateInput!){createDashboard(data:$data){id pageLayoutId}}`, { data: { title: d.name } }); plId = c.createDashboard.pageLayoutId; }
  const tabId = randomUUID();
  const widgets = d.widgets.map(w => build(w, tabId, skip)).filter(Boolean);
  await gql('/metadata', `mutation($id:String!,$input:UpdatePageLayoutWithTabsInput!){updatePageLayoutWithTabsAndWidgets(id:$id,input:$input){id}}`, { id: plId, input: { name: d.name, type: 'DASHBOARD', objectMetadataId: null, tabs: [{ id: tabId, title: d.tab, position: 0, icon: null, layoutMode: 'GRID', widgets }] } });
  console.log(`✓ ${d.name}: ${widgets.length} widgets` + (skip.length ? ` | skipped: ${skip.join(', ')}` : ''));
}
console.log('done.');
