// Scaffold a lean project-management module inside the XO Pure CRM workspace:
//   - Project          (object)
//   - ProjectTask      (object, with status SELECT for Kanban)
//   - relation         ProjectTask.project (MANY_TO_ONE) → Project
//   - Kanban view      on ProjectTask grouped by status
//
// Auth note: twentycrm/twenty:v0.32.0 has a sign/verify mismatch bug — it
// signs API keys with sha256(APP_SECRET + workspaceId + 'ACCESS') but
// verifies with sha256(APP_SECRET + 'undefined' + 'ACCESS'). UI-generated
// keys therefore cannot verify. This script mints a JWT using the
// verify-side derivation, reusing an existing apiKey row's id (jti).
//
// Env required:
//   TWENTY_APP_SECRET        Same APP_SECRET as the running server
//   TWENTY_WORKSPACE_ID      Workspace UUID
//   TWENTY_API_KEY_ID        Existing apiKey row id (jti) to attach the token to
//   TWENTY_SERVER_URL        e.g. https://crm.xopure.com

import crypto from 'node:crypto';
import process from 'node:process';
import jwt from 'jsonwebtoken';

const env = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
  return v;
};

const APP_SECRET = env('TWENTY_APP_SECRET');
const WORKSPACE_ID = env('TWENTY_WORKSPACE_ID');
const API_KEY_ID = env('TWENTY_API_KEY_ID');
const SERVER_URL = env('TWENTY_SERVER_URL').replace(/\/$/, '');
const DRY_RUN = process.env.DRY_RUN === '1';

// Bug-compatible secret: verify side uses 'undefined' because payload has no workspaceId
const verifySecret = crypto
  .createHash('sha256')
  .update(`${APP_SECRET}undefinedACCESS`)
  .digest('hex');

const token = jwt.sign({ sub: WORKSPACE_ID }, verifySecret, {
  algorithm: 'HS256',
  expiresIn: '100y',
  jwtid: API_KEY_ID,
});

const log = (...a) => console.log('[setup-pm]', ...a);

// 2) GraphQL helper
const graphql = async (endpoint, query, variables) => {
  const res = await fetch(`${SERVER_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(
      `GraphQL error at ${endpoint}: ${JSON.stringify(json.errors, null, 2)}`,
    );
  }
  return json.data;
};

// Quick sanity check: list current objects so we know auth works
const sanity = await graphql(
  '/metadata',
  `query { objects(paging: { first: 200 }) { edges { node { id nameSingular } } } }`,
);
const existingObjects = sanity.objects.edges.map((e) => e.node);
log(`auth ok. ${existingObjects.length} existing objects.`);

const byName = (n) =>
  existingObjects.find((o) => o.nameSingular === n)?.id ?? null;

if (DRY_RUN) {
  log('DRY_RUN done. Would create: project, projectTask + fields + Kanban view.');
  process.exit(0);
}

// 3) Create objects (idempotent — skip if exists)
const ensureObject = async (input) => {
  const existing = byName(input.nameSingular);
  if (existing) {
    log(`object exists: ${input.nameSingular} (${existing})`);
    return existing;
  }
  const data = await graphql(
    '/metadata',
    `mutation($input: CreateOneObjectInput!) {
      createOneObject(input: $input) { id nameSingular }
    }`,
    { input: { object: input } },
  );
  log(`created object: ${input.nameSingular} (${data.createOneObject.id})`);
  existingObjects.push(data.createOneObject);
  return data.createOneObject.id;
};

const projectId = await ensureObject({
  nameSingular: 'project',
  namePlural: 'projects',
  labelSingular: 'Project',
  labelPlural: 'Projects',
  icon: 'IconRocket',
  description: 'A project tracked inside XO Pure CRM',
});

const projectTaskId = await ensureObject({
  nameSingular: 'projectTask',
  namePlural: 'projectTasks',
  labelSingular: 'Project Task',
  labelPlural: 'Project Tasks',
  icon: 'IconChecklist',
  description: 'A unit of work inside a Project — Kanban board source',
});

// 4) Fields — idempotent: list existing fields per object, skip duplicates
const listFields = async (objectMetadataId) => {
  const data = await graphql(
    '/metadata',
    `query($filter: objectFilter) {
      objects(paging: { first: 200 }, filter: $filter) {
        edges { node { id nameSingular fields(paging: { first: 200 }) { edges { node { id name type } } } } }
      }
    }`,
    { filter: { id: { eq: objectMetadataId } } },
  );
  const node = data.objects.edges[0]?.node;
  return node?.fields?.edges?.map((e) => e.node) ?? [];
};

const createField = async (objectMetadataId, field) => {
  const existing = (await listFields(objectMetadataId)).find(
    (f) => f.name === field.name,
  );
  if (existing) {
    log(`  = field ${field.name} exists (${existing.id})`);
    return existing;
  }
  const body = {
    field: {
      objectMetadataId,
      isActive: true,
      isCustom: true,
      isNullable: true,
      ...field,
    },
  };
  const data = await graphql(
    '/metadata',
    `mutation($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) { id name type }
    }`,
    { input: body },
  );
  log(
    `  + field ${field.name} (${field.type}) on ${objectMetadataId} → ${data.createOneField.id}`,
  );
  return data.createOneField;
};

// Project fields
await createField(projectId, {
  type: 'SELECT',
  name: 'status',
  label: 'Status',
  icon: 'IconProgressCheck',
  options: [
    { label: 'Planning', value: 'PLANNING', color: 'blue', position: 0 },
    { label: 'Active', value: 'ACTIVE', color: 'green', position: 1 },
    { label: 'On Hold', value: 'ON_HOLD', color: 'orange', position: 2 },
    { label: 'Completed', value: 'COMPLETED', color: 'purple', position: 3 },
    { label: 'Archived', value: 'ARCHIVED', color: 'gray', position: 4 },
  ],
  defaultValue: "'PLANNING'",
});
await createField(projectId, {
  type: 'TEXT',
  name: 'summary',
  label: 'Summary',
  icon: 'IconFileDescription',
});
await createField(projectId, {
  type: 'DATE',
  name: 'startDate',
  label: 'Start Date',
  icon: 'IconCalendarPlus',
});
await createField(projectId, {
  type: 'DATE',
  name: 'endDate',
  label: 'End Date',
  icon: 'IconCalendarCheck',
});

// ProjectTask fields — status is the Kanban grouping key
const taskStatusField = await createField(projectTaskId, {
  type: 'SELECT',
  name: 'status',
  label: 'Status',
  icon: 'IconProgressCheck',
  options: [
    { label: 'Backlog', value: 'BACKLOG', color: 'gray', position: 0 },
    { label: 'To Do', value: 'TODO', color: 'blue', position: 1 },
    { label: 'In Progress', value: 'IN_PROGRESS', color: 'yellow', position: 2 },
    { label: 'In Review', value: 'IN_REVIEW', color: 'orange', position: 3 },
    { label: 'Done', value: 'DONE', color: 'green', position: 4 },
  ],
  defaultValue: "'BACKLOG'",
});
await createField(projectTaskId, {
  type: 'SELECT',
  name: 'priority',
  label: 'Priority',
  icon: 'IconFlag',
  options: [
    { label: 'Low', value: 'LOW', color: 'gray', position: 0 },
    { label: 'Medium', value: 'MEDIUM', color: 'blue', position: 1 },
    { label: 'High', value: 'HIGH', color: 'orange', position: 2 },
    { label: 'Urgent', value: 'URGENT', color: 'red', position: 3 },
  ],
  defaultValue: "'MEDIUM'",
});
await createField(projectTaskId, {
  type: 'TEXT',
  name: 'summary',
  label: 'Summary',
  icon: 'IconFileDescription',
});
await createField(projectTaskId, {
  type: 'DATE_TIME',
  name: 'dueDate',
  label: 'Due Date',
  icon: 'IconCalendarTime',
});

// Relation: Project (1) -< ProjectTask (many) — v0.32.0 uses createOneRelation
const projectFields = await listFields(projectId);
const hasRelation = projectFields.some((f) => f.name === 'tasks' && f.type === 'RELATION');
if (hasRelation) {
  log(`  = relation project.tasks already exists`);
} else {
  await graphql(
    '/metadata',
    `mutation($input: CreateOneRelationInput!) {
      createOneRelation(input: $input) { id relationType }
    }`,
    {
      input: {
        relation: {
          relationType: 'ONE_TO_MANY',
          fromObjectMetadataId: projectId,
          toObjectMetadataId: projectTaskId,
          fromName: 'tasks',
          toName: 'project',
          fromLabel: 'Tasks',
          toLabel: 'Project',
          fromIcon: 'IconChecklist',
          toIcon: 'IconRocket',
        },
      },
    },
  );
  log(`  + relation project.tasks ↔ projectTask.project created`);
}

// 5) Kanban view on ProjectTask grouped by status
const viewData = await graphql(
  '/metadata',
  `mutation($input: CreateViewInput!) {
    createView(input: $input) {
      id name type
    }
  }`,
  {
    input: {
      name: 'Kanban',
      objectMetadataId: projectTaskId,
      type: 'KANBAN',
      icon: 'IconLayoutKanban',
      mainGroupByFieldMetadataId: taskStatusField.id,
      position: 1,
    },
  },
);
log(`Kanban view created: ${viewData.createView.id}`);

log('done.');
