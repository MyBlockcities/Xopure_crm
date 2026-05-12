// Set up XO Pure custom objects in the Twenty CRM workspace.
//
// Idempotent: safe to run repeatedly. Skips objects/fields/relations that
// already exist (matched by nameSingular / field name).
//
// Reads the declarative spec from ./spec.mjs and applies phases up to PHASE.
// Default PHASE=1.
//
// Auth: supports two modes —
//   (a) TWENTY_API_KEY        UI-generated key, used as a Bearer token
//   (b) TWENTY_APP_SECRET +
//       TWENTY_WORKSPACE_ID +
//       TWENTY_API_KEY_ID     JWT mint with verify-side derivation
//                             (workaround for v0.32.0 sign/verify mismatch
//                              bug — see setup-project-management/index.mjs)
//
// The script tries (a) first if TWENTY_API_KEY is set; falls back to (b)
// otherwise. If neither set, errors.
//
// Always-required:
//   TWENTY_SERVER_URL     e.g. https://crm.xopure.com
//
// Optional:
//   PHASE=1               Highest phase to apply (1..5). Default 1.
//   DRY_RUN=1             Plan only — no writes.

import crypto from 'node:crypto';
import process from 'node:process';
import jwt from 'jsonwebtoken';

import { PHASES } from './spec.mjs';

const env = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing env: ${k}`);
    process.exit(1);
  }
  return v;
};

const SERVER_URL = env('TWENTY_SERVER_URL').replace(/\/$/, '');
const TARGET_PHASE = Number(process.env.PHASE ?? '1');
const DRY_RUN = process.env.DRY_RUN === '1';

if (!Number.isInteger(TARGET_PHASE) || TARGET_PHASE < 1) {
  console.error(`PHASE must be a positive integer (got ${process.env.PHASE})`);
  process.exit(1);
}

let token;
let authMode;
if (process.env.TWENTY_API_KEY) {
  token = process.env.TWENTY_API_KEY;
  authMode = 'api-key';
} else if (
  process.env.TWENTY_APP_SECRET &&
  process.env.TWENTY_WORKSPACE_ID &&
  process.env.TWENTY_API_KEY_ID
) {
  const verifySecret = crypto
    .createHash('sha256')
    .update(`${process.env.TWENTY_APP_SECRET}undefinedACCESS`)
    .digest('hex');
  token = jwt.sign(
    { sub: process.env.TWENTY_WORKSPACE_ID },
    verifySecret,
    {
      algorithm: 'HS256',
      expiresIn: '100y',
      jwtid: process.env.TWENTY_API_KEY_ID,
    },
  );
  authMode = 'jwt-derived';
} else {
  console.error(
    'Auth not configured. Set TWENTY_API_KEY, or set all of\n' +
      '  TWENTY_APP_SECRET + TWENTY_WORKSPACE_ID + TWENTY_API_KEY_ID',
  );
  process.exit(1);
}

const log = (...a) => console.log('[setup-objects]', ...a);
const dim = (...a) => console.log('[setup-objects]  ·', ...a);

const stats = { created: 0, skipped: 0, planned: 0 };

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
      `GraphQL error at ${endpoint}:\n${JSON.stringify(json.errors, null, 2)}\nVariables:\n${JSON.stringify(variables, null, 2)}`,
    );
  }
  return json.data;
};

// ─── 1. Auth sanity check + cache existing objects ─────────────────────
const sanity = await graphql(
  '/metadata',
  `query { objects(paging: { first: 500 }) { edges { node { id nameSingular labelSingular } } } }`,
);
const existingObjects = sanity.objects.edges.map((e) => e.node);
log(`auth ok (${authMode}). ${existingObjects.length} existing objects in workspace.`);
log(`mode: ${DRY_RUN ? 'DRY_RUN (no writes)' : 'LIVE'}  ·  phases: 1..${TARGET_PHASE}`);

const objectIdByName = new Map(
  existingObjects.map((o) => [o.nameSingular, o.id]),
);

// ─── 2. Helpers ───────────────────────────────────────────────────────

const listFields = async (objectMetadataId) => {
  const data = await graphql(
    '/metadata',
    `query($filter: objectFilter) {
      objects(paging: { first: 200 }, filter: $filter) {
        edges { node { id nameSingular fields(paging: { first: 500 }) { edges { node { id name type } } } } }
      }
    }`,
    { filter: { id: { eq: objectMetadataId } } },
  );
  const node = data.objects.edges[0]?.node;
  return node?.fields?.edges?.map((e) => e.node) ?? [];
};

const ensureObject = async (input) => {
  const cached = objectIdByName.get(input.nameSingular);
  if (cached) {
    dim(`= object ${input.nameSingular} exists (${cached})`);
    stats.skipped++;
    return cached;
  }
  if (DRY_RUN) {
    dim(`+ object ${input.nameSingular} (would create)`);
    stats.planned++;
    // Synthetic id so downstream planning can continue
    const fakeId = `dryrun:${input.nameSingular}`;
    objectIdByName.set(input.nameSingular, fakeId);
    return fakeId;
  }
  const data = await graphql(
    '/metadata',
    `mutation($input: CreateOneObjectInput!) {
      createOneObject(input: $input) { id nameSingular }
    }`,
    { input: { object: input } },
  );
  const newId = data.createOneObject.id;
  log(`+ object ${input.nameSingular} created (${newId})`);
  stats.created++;
  objectIdByName.set(input.nameSingular, newId);
  return newId;
};

const ensureField = async (objectMetadataId, objectName, fieldSpec) => {
  if (String(objectMetadataId).startsWith('dryrun:')) {
    dim(`  + field ${objectName}.${fieldSpec.name} (${fieldSpec.type}) (would create)`);
    stats.planned++;
    return;
  }
  const existing = (await listFields(objectMetadataId)).find(
    (f) => f.name === fieldSpec.name,
  );
  if (existing) {
    dim(`  = field ${objectName}.${fieldSpec.name} exists (${existing.id})`);
    stats.skipped++;
    return existing;
  }
  if (DRY_RUN) {
    dim(`  + field ${objectName}.${fieldSpec.name} (${fieldSpec.type}) (would create)`);
    stats.planned++;
    return;
  }
  const body = {
    field: {
      objectMetadataId,
      isActive: true,
      isCustom: true,
      isNullable: true,
      ...fieldSpec,
    },
  };
  const data = await graphql(
    '/metadata',
    `mutation($input: CreateOneFieldMetadataInput!) {
      createOneField(input: $input) { id name type }
    }`,
    { input: body },
  );
  log(`  + field ${objectName}.${fieldSpec.name} (${fieldSpec.type}) created (${data.createOneField.id})`);
  stats.created++;
  return data.createOneField;
};

const ensureRelation = async (rel) => {
  const fromId = objectIdByName.get(rel.from.object);
  const toId = objectIdByName.get(rel.to.object);
  if (!fromId || !toId) {
    throw new Error(
      `Relation ${rel.from.object}.${rel.from.name} → ${rel.to.object}.${rel.to.name}: ` +
        `missing object id (fromId=${fromId}, toId=${toId})`,
    );
  }

  // Idempotency: check if either end of the relation already exists by field name.
  if (!String(fromId).startsWith('dryrun:')) {
    const fromFields = await listFields(fromId);
    const exists = fromFields.find(
      (f) => f.name === rel.from.name && f.type === 'RELATION',
    );
    if (exists) {
      dim(`= relation ${rel.from.object}.${rel.from.name} ↔ ${rel.to.object}.${rel.to.name} exists`);
      stats.skipped++;
      return;
    }
  }

  if (DRY_RUN || String(fromId).startsWith('dryrun:')) {
    dim(`+ relation ${rel.from.object}.${rel.from.name} ↔ ${rel.to.object}.${rel.to.name} (would create)`);
    stats.planned++;
    return;
  }

  await graphql(
    '/metadata',
    `mutation($input: CreateOneRelationInput!) {
      createOneRelation(input: $input) { id relationType }
    }`,
    {
      input: {
        relation: {
          relationType: rel.relationType,
          fromObjectMetadataId: fromId,
          toObjectMetadataId: toId,
          fromName: rel.from.name,
          toName: rel.to.name,
          fromLabel: rel.from.label,
          toLabel: rel.to.label,
          fromIcon: rel.from.icon,
          toIcon: rel.to.icon,
        },
      },
    },
  );
  log(`+ relation ${rel.from.object}.${rel.from.name} ↔ ${rel.to.object}.${rel.to.name} created`);
  stats.created++;
};

// ─── 3. Apply phases ──────────────────────────────────────────────────

const phasesToRun = PHASES.filter((p) => p.phase <= TARGET_PHASE);
if (phasesToRun.length === 0) {
  log(`no phases ≤ ${TARGET_PHASE} found in spec. Phases available: ${PHASES.map((p) => p.phase).join(', ')}`);
  process.exit(0);
}

for (const phase of phasesToRun) {
  log(`─── Phase ${phase.phase}: ${phase.label} ───`);

  for (const obj of phase.objects) {
    const { fields, ...objInput } = obj;
    const objectId = await ensureObject(objInput);
    for (const field of fields) {
      await ensureField(objectId, obj.nameSingular, field);
    }
  }

  for (const rel of phase.relations) {
    await ensureRelation(rel);
  }
}

log('─── Summary ───');
log(`created: ${stats.created}   skipped (already exists): ${stats.skipped}   ${DRY_RUN ? `planned: ${stats.planned}` : ''}`);
log('done.');
