// Scaffold a lean project-management module inside the XO Pure CRM workspace:
//   - Project          (object)
//   - ProjectTask      (object, with status SELECT for Kanban)
//   - relation         ProjectTask.project (MANY_TO_ONE) → Project
//   - Kanban view      on ProjectTask grouped by status
//
// Auth: pass an API key generated from the Settings UI
// (https://crm.xopure.com → Settings → APIs & Webhooks → New API Key).
// Hand-minting against the deployed twentycrm/twenty:v0.32.0 image is
// brittle, so we take the boring path.
//
// Env required:
//   TWENTY_API_KEY           Bearer token copied from Settings → APIs & Webhooks
//   TWENTY_SERVER_URL        e.g. https://crm.xopure.com
//
// Optional:
//   DRY_RUN=1                Read existing objects only, no writes.

import process from 'node:process';

const env = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
  return v;
};

const token = env('TWENTY_API_KEY');
const SERVER_URL = env('TWENTY_SERVER_URL').replace(/\/$/, '');
const DRY_RUN = process.env.DRY_RUN === '1';

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

// 4) Fields
const createField = async (objectMetadataId, field, relationCreationPayload) => {
  const body = {
    field: {
      objectMetadataId,
      isActive: true,
      isCustom: true,
      isNullable: true,
      ...field,
    },
  };
  if (relationCreationPayload) {
    body.field.relationCreationPayload = relationCreationPayload;
  }
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

// Relation: ProjectTask.project (MANY_TO_ONE) → Project.tasks
await createField(
  projectTaskId,
  {
    type: 'RELATION',
    name: 'project',
    label: 'Project',
    icon: 'IconRocket',
  },
  {
    type: 'MANY_TO_ONE',
    targetObjectMetadataId: projectId,
    targetFieldLabel: 'Tasks',
    targetFieldIcon: 'IconChecklist',
  },
);

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
