# XO Pure — Ambassador Tree

Interactive genealogy/downline visualization for `crm.xopure.com`.

Deployed as its **own service**, then embedded into Twenty as a **dashboard iframe widget**.
It is deliberately *not* a Twenty front component: those run sandboxed in a Web Worker via
Remote DOM, which does not reliably support imperative D3/Canvas/WebGL rendering.

## 🔒 Read-only contract

This app **must never write to Supabase.**

- Connect with the `crm_readonly` Postgres role (`GRANT SELECT` only).
- **Never** ship a `service_role` key — it bypasses RLS and can write.
- Credentials stay server-side. The browser calls this app's own API route;
  only that route talks to the database.

## Data access

Two interchangeable read-only sources, selected with `TREE_SOURCE`.

**`twenty` (default and recommended).** `sql/ambassador-tree-twenty.sql` walks the
genealogy inside Twenty's own workspace schema, following
`_xopureAmbassador."sponsorAmbassadorExternalId"` -> `"supabaseAmbassadorId"`
(verified 2026-07-26: resolves 211/211 on the live workspace). The XO Pure Apps SDK
objects are already populated there — 215 ambassadors, 108 commission rows — so the
visualization needs **no Supabase credential at all**, and every node id is directly
deep-linkable into the CRM.

**`supabase`.** `sql/ambassador-tree.sql` is the original recursive CTE over
`affiliates.parent_id`, for reading the source of truth directly.

Both return the same flat row shape, annotated with depth and per-node metrics.

Why not Twenty's GraphQL: Twenty resolves relations one level at a time and rate limits
at 100 req/min, so walking a deep downline costs a request per generation per node.
This is one query. Twenty remains the embedding surface and the record deep-link target.

The query is cycle-guarded (`NOT (child.id = ANY(parent.path))`) and depth-bounded,
so a bad `parent_id` cycle cannot hang it.

## Modules

| File | Role |
|---|---|
| `sql/ambassador-tree-twenty.sql` | Recursive CTE over the Twenty mirror (default source) |
| `sql/ambassador-tree.sql` | Recursive CTE over Supabase `affiliates.parent_id` |
| `sql/data-health.sql` | What the sync did not populate — surfaced, never hidden |
| `src/lib/ranks.ts` | The 8 comp-plan ranks: keys, display names, thresholds, colours |
| `src/lib/display.ts` | Money, rate-basis, status, comp week, PII masking (guide §2 = LAW) |
| `src/lib/tree.ts` | Stratify flat rows → nested forest, subtree rollups, lineage, re-root |
| `src/lib/layout.ts` | d3-hierarchy tidy-tree math, collapse state, pan/zoom viewport |

### Rank handling is load-bearing

`COMP_PLAN_LAW §1.5` — internal keys are **permanent**, display names change.
`§2.1` — **never** surface a raw key.

The offset is a permanent hazard:

| Internal key | Displays as |
|---|---|
| `promoter` | **Leader** |
| `leader` | **Executive** |

`toRankKey()` **throws** on an unrecognised rank rather than defaulting (`§2.6`:
never silently drop). An absent rank resolves to `starter` — missing is not unknown.

## Development

```bash
npm install
npm test            # 134 tests
npm run typecheck

DEMO_MODE=1 npm run dev    # no database needed
npm run dev                # against whatever .env.local points at
```

### Two status vocabularies

`_xopureCommission.status` in the Twenty mirror uses `PENDING`/`HELD`/`APPROVED`/`VOID`.
Supabase `commission_ledger.status` uses `held`/`payable`/`paid`/`accrued`/`reversed`/
`voided`. `normalizeLedgerStatus()` maps both onto the canonical set. `PENDING` maps to
`held`, never `payable` — calling it payable would overstate what is owed.

## Environment

Server-side only — never expose these to the browser:

```
SUPABASE_DB_URL      # crm_readonly connection string, SSL required
TWENTY_BASE_URL      # https://crm.xopure.com — for record deep links
TREE_MAX_DEPTH       # default walk depth for lazy loading
```

When embedding, this app must allow being framed by the CRM:

```
Content-Security-Policy: frame-ancestors https://crm.xopure.com
```

## Status

- [x] Recursive CTE data query (Supabase **and** Twenty sources)
- [x] Rank ladder + display-name mapping
- [x] Tree assembly, subtree rollups, lineage, re-rooting
- [x] Next.js app shell + `/api/ambassador-tree` route
- [x] Node-link renderer (d3-hierarchy for layout math, React for rendering)
- [x] Pan/zoom, expand/collapse, collapsed-descendant badges, lineage highlighting
- [x] Inspector panel + CRM deep link
- [x] Data-gap reporting
- [x] **Running against live production data** (215 ambassadors, 8 generations)
- [ ] Node annotation rings — blocked: `orderedAt` is NULL on all 128 live orders,
      so there is no activity history to plot until the sync populates it
- [ ] Radial, grid/block, and parallel-coordinates layout modes
- [ ] Embed into crm.xopure.com

See `docs/XOPURE_MASTER_PLAN.md` for the full roadmap.
