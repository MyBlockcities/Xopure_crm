// Port the native dashboard templates (twenty-front DashboardTemplates.ts) into a
// running Twenty workspace as Dashboard + PageLayout + widget records, by
// replicating the frontend's instantiation logic (buildDraftPageLayoutFromTemplate
// + updatePageLayoutWithTabsAndWidgets) against the GraphQL API.
//
// Why: the dashboards are frontend templates that the stock upstream image doesn't
// instantiate. This recreates them server-side so any Twenty 2.x instance (even
// without the custom fork frontend) shows the boards, wired to the synced model
// (ambassador / customer / xoOrder / period / product).
//
// Env:
//   TWENTY_SERVER_URL   e.g. https://crm-v2-production-abc9.up.railway.app
//   TWENTY_API_KEY      Admin API key for the target workspace
//
// Idempotent: updates existing dashboards (matched by title) to the full widget
// set; creates any that are missing. Widgets whose object/field can't be resolved
// in the workspace are skipped (never produces broken cards).

import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import fs from 'fs';

const require = createRequire(import.meta.url);
const SERVER = (process.env.TWENTY_SERVER_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.TWENTY_API_KEY ?? '';
if (!SERVER || !TOKEN) {
  console.error('Missing TWENTY_SERVER_URL or TWENTY_API_KEY');
  process.exit(1);
}

// Map template field names to the closest existing field on the synced model.
const FIELD_ALIAS = {
  product: { isActive: 'commissionEligible' },
  customer: { enrolledAt: 'createdAt' },
  period: { endDate: 'startDate' },
};

// --- load DASHBOARD_TEMPLATES from the fork source (transpile, stub enums) ---
const loadTemplates = () => {
  const esbuild = require(
    require.resolve('esbuild', { paths: [process.cwd(), process.cwd() + '/packages/twenty-front'] }),
  );
  const path = 'packages/twenty-front/src/modules/dashboards/templates/constants/DashboardTemplates.ts';
  let src = fs.readFileSync(path, 'utf8');
  src = src.replace(/import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?/g, '');
  src = 'const AggregateOperations = new Proxy({}, { get: (_, k) => k });\n' + src;
  const out = esbuild.transformSync(src, { loader: 'ts', format: 'cjs' });
  const m = { exports: {} };
  new Function('module', 'exports', 'require', out.code)(m, m.exports, require);
  return m.exports.DASHBOARD_TEMPLATES;
};

const gql = async (endpoint, query, variables) => {
  const res = await fetch(`${SERVER}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(endpoint + ' :: ' + JSON.stringify(json.errors, null, 2));
  return json.data;
};

const templates = loadTemplates();

const meta = await gql('/metadata',
  `{ objects(paging:{first:200}){ edges { node { id nameSingular fields(paging:{first:500}){ edges { node { id name } } } } } } }`);
const objByName = {};
for (const e of meta.objects.edges) {
  const o = e.node;
  objByName[o.nameSingular] = { id: o.id, fields: Object.fromEntries(o.fields.edges.map((f) => [f.node.name, f.node.id])) };
}
const resolveObj = (n) => objByName[n]?.id;
const resolveField = (n, f) => objByName[n]?.fields?.[FIELD_ALIAS[n]?.[f] ?? f];

const existing = await gql('/graphql', `query { dashboards(first: 500) { edges { node { id title pageLayoutId } } } }`);
const existingByTitle = new Map((existing.dashboards?.edges ?? []).map((e) => [e.node.title, e.node]));

const buildConfig = (w, groupId, aggId) => {
  const aggregateOperation = w.aggregateOperation ?? 'COUNT';
  const vis = w.visualization ?? 'bar';
  if (['bar', 'line', 'pie'].includes(vis) && !groupId) return undefined;
  const g = groupId ?? '';
  switch (vis) {
    case 'bar': return { __typename: 'BarChartConfiguration', configurationType: 'BAR_CHART', layout: 'VERTICAL', displayDataLabel: true, displayLegend: true, color: 'auto', primaryAxisGroupByFieldMetadataId: g, aggregateFieldMetadataId: aggId, aggregateOperation, primaryAxisOrderBy: 'FIELD_POSITION_ASC', axisNameDisplay: 'NONE' };
    case 'line': return { __typename: 'LineChartConfiguration', configurationType: 'LINE_CHART', displayDataLabel: true, displayLegend: true, color: 'auto', primaryAxisGroupByFieldMetadataId: g, aggregateFieldMetadataId: aggId, aggregateOperation, primaryAxisOrderBy: 'FIELD_POSITION_ASC', axisNameDisplay: 'NONE' };
    case 'pie': return { __typename: 'PieChartConfiguration', configurationType: 'PIE_CHART', displayDataLabel: true, displayLegend: true, color: 'auto', groupByFieldMetadataId: g, aggregateFieldMetadataId: aggId, aggregateOperation, orderBy: 'VALUE_DESC' };
    case 'aggregate': return { __typename: 'AggregateChartConfiguration', configurationType: 'AGGREGATE_CHART', displayDataLabel: true, aggregateFieldMetadataId: aggId, aggregateOperation };
    case 'gauge': return { __typename: 'GaugeChartConfiguration', configurationType: 'GAUGE_CHART', displayDataLabel: true, color: 'auto', aggregateFieldMetadataId: aggId, aggregateOperation };
  }
};

const buildWidget = (w, tabId, skipped) => {
  const id = randomUUID();
  const pos = (gp) => ({ layoutMode: 'GRID', row: gp.row, column: gp.column, rowSpan: gp.rowSpan, columnSpan: gp.columnSpan });
  if (w.type === 'graph') {
    const objId = resolveObj(w.objectNameSingular);
    if (!objId) { skipped.push(`${w.title} (no object ${w.objectNameSingular})`); return null; }
    const groupId = w.groupByFieldName ? resolveField(w.objectNameSingular, w.groupByFieldName) : undefined;
    const aggId = resolveField(w.objectNameSingular, w.aggregateFieldName ?? 'id');
    if (!aggId) { skipped.push(`${w.title} (no field ${w.aggregateFieldName ?? 'id'})`); return null; }
    const configuration = buildConfig(w, groupId, aggId);
    if (!configuration) { skipped.push(`${w.title} (groupBy missing)`); return null; }
    return { id, pageLayoutTabId: tabId, title: w.title, type: 'GRAPH', objectMetadataId: objId, gridPosition: w.gridPosition, position: pos(w.gridPosition), configuration, conditionalAvailabilityExpression: null };
  }
  if (w.type === 'recordTable') {
    const objId = resolveObj(w.objectNameSingular);
    if (!objId) { skipped.push(`${w.title} (no object ${w.objectNameSingular})`); return null; }
    return { id, pageLayoutTabId: tabId, title: w.title, type: 'RECORD_TABLE', objectMetadataId: objId, gridPosition: w.gridPosition, position: pos(w.gridPosition), configuration: { __typename: 'RecordTableConfiguration', configurationType: 'RECORD_TABLE' }, conditionalAvailabilityExpression: null };
  }
  if (w.type === 'frontComponent') { skipped.push(`${w.title} (live front-component; needs xopure-crm app)`); return null; }
  return null;
};

let total = 0;
for (const t of templates) {
  const skipped = [];
  let pageLayoutId = existingByTitle.get(t.name)?.pageLayoutId;
  if (!pageLayoutId) {
    const created = await gql('/graphql', `mutation($data: DashboardCreateInput!){ createDashboard(data:$data){ id pageLayoutId } }`, { data: { title: t.name } });
    pageLayoutId = created.createDashboard.pageLayoutId;
  }
  if (!pageLayoutId) { console.log(`!! ${t.name}: no pageLayoutId`); continue; }
  const tabs = t.tabs.map((tab, ti) => {
    const tabId = randomUUID();
    const widgets = tab.widgets.map((w) => buildWidget(w, tabId, skipped)).filter(Boolean);
    return { id: tabId, title: tab.title, position: ti, icon: tab.icon ?? null, layoutMode: 'GRID', widgets };
  });
  await gql('/metadata', `mutation($id:String!,$input:UpdatePageLayoutWithTabsInput!){ updatePageLayoutWithTabsAndWidgets(id:$id,input:$input){ id } }`, { id: pageLayoutId, input: { name: t.name, type: 'DASHBOARD', objectMetadataId: null, tabs } });
  const wc = tabs.reduce((a, tb) => a + tb.widgets.length, 0);
  total += wc;
  console.log(`✓ ${t.name}: ${wc} widgets` + (skipped.length ? ` | skipped ${skipped.length}` : ''));
}
console.log(`\nDONE — ${total} widgets across ${templates.length} dashboards.`);
