# Twenty CRM embed runbook — Ambassador Tree

## Current readiness

The Ambassador Tree is a standalone Next.js application designed to run inside
a Twenty dashboard `IFRAME` widget. The application already:

- reads the Twenty workspace mirror through a transaction-enforced read-only
  Postgres connection;
- deep-links selected ambassadors back to their Twenty records;
- accepts `?rootId=<twenty-ambassador-uuid>` to open a specific subtree;
- allows framing only from `TWENTY_BASE_URL` through CSP `frame-ancestors`;
- keeps exports disabled in production unless explicitly enabled.

Do not add the iframe to the production CRM until the deployed tree URL has an
authentication boundary. CSP controls who may frame a page; it does not stop a
person from opening that page directly.

## Required production environment

Set these only on the standalone tree service:

```text
TREE_SOURCE=twenty
TWENTY_PG_URL=<read-only-capable Twenty Postgres URL>
TWENTY_WORKSPACE_SCHEMA=<workspace_xxx>
TWENTY_BASE_URL=https://crm.xopure.com
TREE_EXPORTS_ENABLED=0
DEMO_MODE=0
```

The database connection code sets `default_transaction_read_only=on` and opens
every query with `BEGIN TRANSACTION READ ONLY`. Do not put a Supabase
`service_role` key in this service.

## Authentication gate

Use the same authenticated reverse proxy or access layer that protects the CRM,
and authorize only XO Pure CRM users. The protected service must still permit
iframe loading from `https://crm.xopure.com`.

Before production, verify:

1. An unauthenticated direct request is rejected or redirected to sign-in.
2. An authenticated CRM user can load the tree in an iframe.
3. The response CSP contains
   `frame-ancestors https://crm.xopure.com`.
4. Database writes fail from the tree service connection.
5. `TREE_EXPORTS_ENABLED=0` unless role-aware export authorization is present.

## Add the Twenty dashboard widget

In Twenty, create or edit the XO Pure operations dashboard and add an **Iframe**
widget with the protected deployment URL:

```text
https://<protected-tree-host>/
```

Use a wide dashboard placement (12 columns is preferred) and enough vertical
space for the genealogy plus inspector. The embedded app is responsive and
switches its inspector to a lower sheet on narrow layouts.

For a stable ambassador-specific link, use:

```text
https://<protected-tree-host>/?rootId=<twenty-ambassador-record-id>
```

The `rootId` must be the Twenty `_xopureAmbassador.id`, not the Supabase
ambassador id.

## Data-accuracy gate

The visualization displays current ledger state accurately from mirrored
commission rows:

- weekly payable;
- weekly clearing/held;
- paid;
- monthly generation accrued.

It intentionally withholds week-by-week history until the sync carries the
authoritative source earning timestamp for every commission. Twenty
`createdAt` is not an acceptable substitute because it is a mirror-record
timestamp and can assign earnings to the wrong compensation week.

The dashboard itself reports:

- order-attribution coverage;
- commission pay-area classification coverage;
- order-timeline coverage;
- sponsor-link defects.

A displayed zero is trustworthy only for a metric whose corresponding coverage
is complete.

## Acceptance test

After deploying to staging:

1. Compare ambassador count and sponsor edges with Twenty.
2. Compare commission row count and cent totals by status and pay area.
3. Open at least one known large downline and one leaf ambassador.
4. Confirm weekly rails exclude every `GENERATION_*` row.
5. Confirm the monthly generation rail includes those rows.
6. Confirm an unmapped pay area appears as a data gap.
7. Confirm the CRM record link opens the selected ambassador.
8. Test genealogy and radial layouts in desktop and narrow widget sizes.
9. Confirm direct unauthenticated access is blocked.

