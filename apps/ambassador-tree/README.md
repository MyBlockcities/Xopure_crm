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

`sql/ambassador-tree.sql` is a single recursive CTE that walks `affiliates.parent_id`
and returns the whole requested subtree annotated with depth, materialized path, and
per-node metrics.

Why not Twenty's GraphQL: Twenty resolves relations one level at a time and rate limits
at 100 req/min, so walking a deep downline costs a request per generation per node.
This is one query. Twenty remains the embedding surface and the record deep-link target.

The query is cycle-guarded (`NOT (child.id = ANY(parent.path))`) and depth-bounded,
so a bad `parent_id` cycle cannot hang it.

## Modules

| File | Role |
|---|---|
| `sql/ambassador-tree.sql` | Recursive CTE — the entire tree in one read-only query |
| `src/lib/ranks.ts` | The 8 comp-plan ranks: keys, display names, thresholds, colours |
| `src/lib/tree.ts` | Stratify flat rows → nested forest, subtree rollups, lineage, re-root |

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
npm test          # 30 tests
npm run typecheck
```

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

- [x] Recursive CTE data query
- [x] Rank ladder + display-name mapping
- [x] Tree assembly, subtree rollups, lineage, re-rooting
- [ ] Next.js app shell + `/api/ambassador-tree` route
- [ ] Node-link renderer (d3-hierarchy for layout math, React for rendering)
- [ ] Node annotation rings (tier ring, activity heatmap, revenue bar)
- [ ] Radial, grid/block, and parallel-coordinates layout modes
- [ ] Embed into crm.xopure.com

See `docs/XOPURE_MASTER_PLAN.md` for the full roadmap.
