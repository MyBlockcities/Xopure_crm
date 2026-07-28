# XO Pure Tree Visualization and Phylo-Forge Architecture Assessment

**Date:** 2026-07-27  
**Status:** Architecture recommendation; no production schema, application, or deployment changes made  
**Primary artifact reviewed:** `phylo-forge.skill`  
**Target surface:** `crm.xopure.com`, via the standalone `apps/ambassador-tree` service embedded in Twenty

## Implementation status — 2026-07-27

The first non-breaking implementation is complete in `apps/ambassador-tree`:

- versioned `xopure.visualization-graph/v1` canonical DTO;
- deterministic canonical JSON and SHA-256 graph revision;
- strict graph validation and stable CRM-id export identity;
- export-only synthetic root for forests, without changing business records;
- additive radial layout with rank, qualification, activity, review, downline,
  lineage, collapse, tooltip, keyboard, and inspector integration;
- server-only JSON, Newick, Nexus, PhyloXML, SVG, and deterministic iTOL ZIP;
- opt-in production export endpoint with cyclic-graph blocking and `If-Match`
  stale-revision protection;
- direct, private, non-persistent delivery with no Supabase writes;
- export UI hidden unless the server capability is enabled;
- format, graph, layout, privacy, determinism, ZIP-integrity, browser, and
  negative-route verification.

PNG/PDF rasterization, durable artifact persistence, automatic third-party iTOL
upload, and production deployment remain intentionally gated. They require,
respectively, an isolated renderer, an approved storage policy, a privacy/vendor
decision, and deployment authority. They are not silently enabled by this work.

### Final polish and verification — 2026-07-27

- radial generation rings now derive from actual visible hierarchy depth;
- forest mode has a clearly identified, non-business central network hub;
- the radial canvas reserves inspector width on desktop and restores full width
  beneath the responsive bottom sheet;
- controls are surfaced before legends and review queues;
- export controls are an intentional disclosure rather than permanent visual
  noise;
- responsive rail layout, reduced-motion behavior, focus states, hover
  affordances, and radial legibility were reviewed in Chromium;
- export labels redact the UI's email-derived fallback-name edge case;
- desktop and 820 px responsive screenshots have no console or failed-network
  errors;
- the final suite contains 147 passing tests, including a 5,000-node deep-chain
  regression; strict typecheck and optimized Next.js build pass.

The result is ready for demo/internal testing. Production exports remain off
until the standalone service is protected by authenticated, role-aware access.

## Executive decision

XO Pure should adopt the **canonical-graph-first idea** from `phylo-forge`, but should **not install or execute the skill unchanged** and should **not introduce its proposed `trees` / `tree_nodes` schema into Supabase for the CRM genealogy**.

The repository already contains the correct low-risk foundation:

- `affiliates.parent_id` is the source genealogy in Supabase.
- `_xopureAmbassador` is the synchronized, CRM-native mirror in Twenty.
- `apps/ambassador-tree` turns a flat, cycle-guarded recursive query into a tested internal tree.
- Its React/SVG renderer already supports pan, zoom, fit, collapse, lineage selection, subtree re-rooting, responsive framing, and CRM record deep links.
- The visualization is isolated as a standalone Next.js service because Twenty front components are not a reliable host for imperative SVG/Canvas/WebGL work.
- Its database boundary is deliberately read-only.

The safest architecture is therefore:

1. Keep the existing ambassador and sponsorship records as the source of truth.
2. Add a **versioned visualization DTO** as the canonical interchange model at the standalone app boundary.
3. Extend the existing React/D3 renderer with additional layouts and annotation tracks.
4. Add export adapters behind a server-only interface.
5. Store generated artifacts outside Supabase initially, or only introduce Supabase Storage after an explicit exception to the repository's read-only policy.
6. Treat Newick, Nexus, PhyloXML, iTOL datasets, SVG, PNG, and PDF as disposable derivatives.

This preserves the working application and avoids maintaining a second genealogy that can drift from `affiliates` or the Twenty mirror.

## What was inspected

### Existing XO Pure implementation

The assessment covered:

- `apps/ambassador-tree/README.md`
- `apps/ambassador-tree/src/lib/tree.ts`
- `apps/ambassador-tree/src/lib/layout.ts`
- `apps/ambassador-tree/src/components/tree-explorer.tsx`
- `apps/ambassador-tree/src/components/tree-canvas.tsx`
- `apps/ambassador-tree/src/server/db.ts`
- `apps/ambassador-tree/src/server/ambassador-tree.ts`
- `apps/ambassador-tree/src/app/api/ambassador-tree/route.ts`
- `apps/ambassador-tree/sql/ambassador-tree.sql`
- `apps/ambassador-tree/sql/ambassador-tree-twenty.sql`
- `apps/ambassador-tree/next.config.mjs`
- the XO Pure Supabase schema migrations
- the dashboard, portal, and master-plan documentation

### Packaged skill

The ZIP-based `phylo-forge.skill` contains:

- `phylo-forge/SKILL.md`
- `phylo-forge/references/formats.md`
- `phylo-forge/references/supabase-schema.md`
- `phylo-forge/references/viewers.md`
- `phylo-forge/scripts/tree_forge.py`

The script was also exercised locally on a small canonical JSON tree. Its validation and all-format export happy path completed, and its PhyloXML output was XML-well-formed. That is a smoke check, not proof of format conformance.

## Current application architecture

```text
Supabase source                       Twenty CRM mirror
affiliates.parent_id                  _xopureAmbassador sponsor relation
        │                                      │
        └──────── read-only sync ──────────────┘
                                               │
                             recursive, bounded, cycle-guarded SQL
                                               │
                                    AmbassadorRow[]
                                               │
                         buildTree(): validated TreeNode forest
                                               │
                    ┌──────────────────────────┼─────────────────────┐
                    │                          │                     │
             layoutForest()             inspector/rail       export adapters
               D3 math                    CRM links             (proposed)
                    │
              React-owned SVG
                    │
          standalone Next.js service
                    │
         iframe inside crm.xopure.com
```

This is a strong design. It avoids one GraphQL request per node/generation, keeps PostgreSQL access on the server, and avoids coupling a sophisticated renderer to Twenty's front-component sandbox.

## What the existing app already does well

### Data correctness

- Both source queries return a common flat row shape.
- Recursive SQL is depth-bounded and guards against cycles.
- `buildTree()` detects cycles again at the application layer.
- Missing parents are surfaced as orphans rather than hidden.
- Numeric strings returned by `node-postgres` are deliberately normalized.
- Subtree business metrics are computed bottom-up.
- Unknown compensation ranks fail loudly.
- Existing status vocabularies are normalized rather than conflated.

These are more valuable to XO Pure than generic phylogenetic abstractions. They encode the actual business semantics and must remain upstream of any visualization/export library.

### Interaction and rendering

- D3 is used only for hierarchy geometry; React owns the DOM.
- The current renderer has a stable `TreeNode` model and a separate `TreeLayout` result.
- Collapse state, hidden-descendant counts, lineage highlighting, fit-to-viewport, pan, zoom, keyboard controls, and inspector avoidance are already implemented.
- The forest model correctly tolerates more than one root.
- The iframe CSP is restricted to the CRM host.

### Safety boundary

`src/server/db.ts` rejects non-read SQL, requests a read-only transaction, configures the database session as read-only, and rejects obviously privileged connection strings. The browser receives tree JSON from the app route and never receives database credentials.

This boundary should remain intact.

## Interpretation of the phylo-forge skill

### Ideas worth adopting

The strongest ideas in the skill are conceptual:

- one canonical graph;
- exports as regenerable derivatives;
- structural validation before export;
- exact, stable node identifiers;
- deterministic output and checksums;
- separate topology, annotation, render, and storage concerns;
- Newick for compact interchange;
- PhyloXML for rich archival interchange;
- iTOL datasets as separate visualization overlays;
- fail-closed export batches.

Those ideas transfer well to a business genealogy even though XO Pure is not doing biological phylogenetics.

### Claims that are only partially implemented

The skill description is broader than `tree_forge.py`:

| Claimed capability | Actual implementation |
|---|---|
| Ingest Newick, Nexus, PhyloXML, files, and pasted strings | No file-format parser; only canonical JSON or a PostgREST table fetch |
| Read nodes and annotations from Supabase | Fetches one node table only; it does not join `tree_annotations` |
| Canonical graph with nodes and edges | Parent pointers embedded in node rows; no separate edge model |
| Rich iTOL datasets | Only `TREE_COLORS` and `DATASET_COLORSTRIP` |
| SVG/PNG/PDF rendering | No renderer |
| Storage upload and export tracking | Described only; not implemented |
| iTOL API upload | Described only; not implemented |
| Duplicate labels block iTOL generation | Validator emits a warning; `itol` still writes files |
| Fail-closed all-format batch | Files are written sequentially without a staging directory or atomic promotion |
| Byte-identical exports | Likely on one Python/runtime version, but not contract-tested |
| Rich PhyloXML | Some color/taxonomy/properties, but no standard namespace/schema declaration and no conformance test |

### Implementation defects to fix before reuse

1. **Repository policy conflict.** The skill tells an exporter to use a Supabase service key and write Storage and `tree_exports`. XO Pure's current master plan explicitly makes Supabase an absolute read-only source. This is the largest integration blocker.

2. **Wrong canonical owner for CRM genealogy.** Adding `trees` and `tree_nodes` would copy the sponsorship graph into a second mutable store. The existing `affiliates` / Twenty records already own this truth.

3. **No import pipeline.** A production exporter needs parsers, parser limits, input-size limits, encoding rules, and round-trip tests. The script has only writers.

4. **Incomplete Supabase adapter.** It accepts near-standard column aliases but does not retrieve the proposed annotation rows, tree metadata, sibling order, visibility, tenant ownership, or graph revision.

5. **Falsy-value corruption.** Expressions such as `r.get("branch_length") or r.get("length")` and the equivalent support mapping treat valid zero values as missing.

6. **Validation/export mismatch.** Invalid colors and nonnumeric support are warnings, but the PhyloXML writer can crash or emit invalid semantics. Negative lengths are silently clamped during export, changing data rather than forcing an explicit normalization decision.

7. **Duplicate label mismatch.** The documentation says duplicate tip labels become an iTOL error; the CLI does not enforce it.

8. **Partial batch risk.** `--format all` can leave a Newick file behind if a later format fails. Production generation needs stage → validate → checksum → atomically publish.

9. **Format conformance gaps.** XML well-formedness is not PhyloXML schema validity. Nexus/Newick output also needs independent parser round trips.

10. **Unbounded recursion and output.** Recursive serialization may hit Python recursion limits for deep trees. There are no limits on nodes, depth, label length, annotation size, or output size.

11. **Unescaped iTOL fields.** Labels, dataset names, and annotations need separator/newline handling and an explicit stable-key strategy.

12. **Identifier semantics.** iTOL datasets keyed only by display labels are fragile. XO Pure names are neither unique nor permanent. Exported machine identifiers should be stable opaque IDs, with human names emitted as labels.

13. **No provenance model.** There is no input graph revision, exporter version, options digest, requested-by identity, or source snapshot recorded in the output.

14. **No job isolation.** A server-side exporter must use per-job temporary directories, safe filenames, timeouts, memory limits, and cleanup.

## The canonical model XO Pure should use

Do not force the current business graph into the skill's biological field names. Introduce a versioned DTO that preserves the CRM model and can be adapted into phylogenetic formats.

```ts
interface VisualizationGraphV1 {
  schemaVersion: 'xopure.visualization-graph/v1';
  graphId: string;
  graphType: 'ambassador-genealogy';
  rooted: true;
  source: {
    system: 'twenty' | 'supabase';
    rootId: string | null;
    capturedAt: string;
    revision: string;
  };
  nodes: Array<{
    id: string;
    parentId: string | null;
    order: number;
    label: string;
    kind: 'ambassador';
    metrics: Record<string, number | string | boolean | null>;
    visual: {
      color?: string;
      size?: number;
      badges?: string[];
    };
  }>;
}
```

Important decisions:

- `id`, not name, is the machine identity.
- `label` is presentation data.
- `order` makes sibling order deterministic.
- `revision` is an input hash or reliable source revision.
- `schemaVersion` makes future migration explicit.
- business metrics remain typed annotations; they are not misrepresented as phylogenetic support values or branch lengths.
- genealogy edges do not naturally have evolutionary distance. Default to a cladogram. If XO Pure later offers a time-scaled view, call that value `elapsedTime` internally and only map it to a branch length for an explicitly named export profile.

For the current app, this DTO can initially be generated from the existing `TreeNode` forest with no database change.

## Recommended layered architecture

### 1. Source adapters

- `TwentyTreeSource`: current default, reading `_xopureAmbassador`.
- `SupabaseTreeSource`: current alternate, read-only.
- `UploadedTreeSource`: future, quarantined parser path for scientific files.

Do not mix uploaded scientific trees into the ambassador genealogy unless there is a defined product use case. They may share rendering infrastructure while remaining different graph types.

### 2. Canonical graph service

Add a pure module alongside `src/lib/tree.ts`:

- flatten/nest conversion;
- stable ordering;
- invariant validation;
- annotation attachment;
- graph revision hashing;
- export-profile mapping;
- size/depth limits.

Keep `TreeNode` for the UI initially. Add adapters rather than a large rewrite.

### 3. Render layer

Retain the current React/SVG renderer for the principal CRM experience. Extend it behind a layout strategy:

```ts
type LayoutMode =
  | 'genealogy'
  | 'rectangular-cladogram'
  | 'radial'
  | 'unrooted'
  | 'compact';
```

Recommended order:

1. **Radial/circular genealogy** using D3 hierarchy geometry and the existing React renderer.
2. **Annotation rings/tracks** for rank, status, activity, volume, and data quality.
3. **Compact density mode** for large downlines.
4. **Static SVG export** from the same semantic scene.
5. Canvas/WebGL only after measurement shows SVG is the bottleneck.

This preserves accessible React controls and CRM deep links. A wholesale replacement with an imperative third-party viewer would regress those product-specific features.

### 4. Export layer

Define server-only ports:

```ts
interface TreeExporter {
  export(graph: VisualizationGraphV1, request: ExportRequest): Promise<ExportArtifact[]>;
}
```

Suggested profiles:

- `newick-topology`: stable IDs as leaf tokens; optional labels in a companion mapping.
- `nexus-interchange`: topology plus a translate table.
- `phyloxml-rich`: labels, rank/status properties, and colors.
- `itol-package`: Newick plus one or more datasets.
- `svg-current-view`: exact branded CRM view.
- `png-preview`: bounded preview.
- `pdf-report`: branded printable report.
- `json-canonical`: lossless XO Pure interchange.

Do not describe Newick as a lossless export for XO Pure. It cannot preserve the application semantics.

### 5. Job and artifact layer

The existing visualization service is read-only. Preserve that default:

- synchronous JSON/Newick/SVG downloads can stream directly without persistence;
- larger PNG/PDF/iTOL bundles should run in a separate exporter worker;
- initially store outputs in the service's existing deployment storage or a separately approved artifact store;
- if Supabase Storage is later authorized, use a private bucket and server-generated signed URLs.

Supabase documents that public-bucket objects are publicly accessible, while private objects require authenticated access or a time-limited signed URL. For ambassador genealogies, private must be the default: [Supabase Storage serving assets](https://supabase.com/docs/guides/storage/serving/downloads).

## Storage recommendation and the read-only law

The supplied proposal assumes Supabase Storage writes. That is **not currently authorized by this repository's governing documentation**.

There are three viable choices:

### Option A — recommended now: no persistent export storage

- Generate on demand.
- Stream the file to the authorized user.
- Cache only in process or in the deployment platform's ephemeral cache.
- No Supabase policy or schema changes.

This is the least risky first release.

### Option B — separate artifact service

- A dedicated worker and bucket outside the source Supabase project.
- Short-lived access URLs.
- Its credentials are not available to the browser or read-only visualization runtime.

This preserves the Supabase read-only law while enabling durable exports.

### Option C — explicitly authorize Supabase Storage writes

Only choose this after a human policy decision. If authorized:

- use a private bucket;
- keep write credentials in a dedicated server/worker;
- never put a service-role key in the client;
- scope paths by workspace/project/user;
- enable RLS/policies for `storage.objects`;
- remember Storage upsert requires `INSERT`, `SELECT`, and `UPDATE`;
- store immutable content-addressed artifacts rather than overwriting;
- retain export metadata in Twenty or a dedicated private schema, not an exposed unprotected table.

The skill's generic “public bucket for stable URLs” advice is inappropriate for a genealogy containing names, emails, ranks, and performance data.

## Open-source component decision

### Keep: D3 hierarchy + React SVG

This is already installed, tested, and integrated. It is the lowest-breakage path for radial layout, annotation rings, selection, and branded interaction.

### Add selectively: phylotree.js

`phylotree.js` is a credible optional parser/analysis and experimental viewer dependency. Its repository documents MIT licensing, TypeScript declarations, Newick parsing/export, linear and radial views, collapse, rerooting, ladderization, branch selection, and trees with thousands of tips. The current release shown by its repository is 2.5.0 (2026-02-13): [veg/phylotree.js](https://github.com/veg/phylotree.js).

Use it behind an adapter and feature flag for:

- independent Newick round-trip tests;
- scientific tree preview;
- radial layout experiments;
- midpoint/root-to-tip tooling if that becomes a real product need.

Do not give it ownership of the CRM DOM or canonical graph in the first phase.

### Do not adopt as the primary frontend: treelib-js

It can be useful as an algorithm/reference source, but it would duplicate working layout/render behavior and offers less integration value than the current typed React app. If code is borrowed, pin the exact commit, retain license notices, isolate it, and add regression tests.

### Backend formats: prefer Biopython over handwritten serializers

Biopython's current `Bio.Phylo` documentation exposes `parse`, `read`, `write`, and `convert` for Newick, Nexus, PhyloXML, and NeXML. It also explicitly notes that branch colors and widths are lost when saving Newick/Nexus and preserved in PhyloXML: [Biopython Phylogenetics documentation](https://biopython.org/docs/latest/Tutorial/chapter_phylo.html).

For production-grade import/export, a small Python worker using Biopython is safer than expanding the handwritten stdlib serializer. Still wrap it with:

- pinned dependencies;
- golden fixtures;
- round-trip tests through at least two independent parsers;
- schema validation for PhyloXML;
- resource limits;
- deterministic normalization.

### Optional offline/publication tooling

- ETE is appropriate for isolated server-side manipulation or alternate static rendering.
- ggtree is excellent for deliberate publication pipelines, but adding an R runtime to the interactive CRM service is unjustified.
- iTOL is useful as an external compatibility/export target, not as the embedded core experience. Sending genealogy data to it requires a privacy/vendor review and explicit user action.

## iTOL strategy

An iTOL package should be a ZIP generated only on request:

```text
tree.nwk
labels.txt
rank-colorstrip.txt
status-symbols.txt
monthly-activity-heatmap.txt
volume-bars.txt
manifest.json
```

Rules:

- Newick node tokens use stable opaque IDs.
- A label dataset supplies display names.
- Every dataset is produced from the same graph revision.
- Duplicate display names are allowed because IDs remain unique.
- `manifest.json` records graph revision, exporter version, dataset list, and checksums.
- No automatic upload to iTOL in the first release.
- Automatic upload, if ever added, requires explicit confirmation because it transfers CRM data to a third party.

## Security and privacy requirements

1. Never include email, address, payout, or customer PII in a default export.
2. Define export scopes: `presentation`, `operations`, and `full-admin`.
3. Authorize the requested root/subtree on the server; never trust `rootId` alone.
4. Rate-limit export endpoints independently from tree reads.
5. Cap node count, depth, annotation bytes, output dimensions, and render time.
6. Sanitize labels for XML, Nexus, Newick, iTOL, SVG, filenames, and ZIP entries separately.
7. Prevent SVG script/event injection; serve downloads with safe content disposition and `nosniff`.
8. Run file parsers and rasterizers in an isolated worker, not in the CRM web process.
9. Never expose service-role, S3, database, or iTOL credentials to the browser.
10. Log artifact metadata, not exported PII.
11. Use private delivery by default.
12. Add retention and deletion rules before durable storage.

## Non-breaking implementation plan

### Phase 0 — lock contracts and fixtures

- Add representative graph fixtures: multiple roots, orphan, cycle, duplicate names, Unicode, quotes, deep chain, wide tree, missing metrics, and zero-valued metrics.
- Snapshot the current `TreeNode` API response.
- Add performance baselines at 250, 1,000, 5,000, and 10,000 nodes.
- Record current visual screenshots.
- Define `VisualizationGraphV1` and conversion tests.

**Exit:** no UI change; existing tests and screenshots remain stable.

### Phase 1 — layout strategy inside the existing app

- Extract current layout as `genealogy`.
- Add a feature-flagged radial layout using D3 math.
- Keep the same `TreeNode`, selection, collapse, inspector, and deep links.
- Add rank/status legends and accessible non-color encodings.

**Exit:** current mode remains default; radial mode is additive and reversible.

### Phase 2 — annotations

- Convert `monthlyActivity`, rank, status, sponsor-review, and volume into typed tracks.
- Add rectangular side tracks first, radial rings second.
- Add tooltips and inspector detail without adding raw PII to SVG markup.

**Exit:** annotation rendering has deterministic geometry and unit tests.

### Phase 3 — pure exports

- Add `json`, Newick, Nexus, and PhyloXML exporters behind one interface.
- Use Biopython in an isolated worker or rigorously upgrade the supplied script.
- Stage an entire batch, validate every artifact, compute checksums, then publish/stream it.
- Add round-trip and golden-file tests.

**Exit:** no partial batches; same input revision/options produce the same bytes.

### Phase 4 — static presentation

- Serialize the branded React scene to SVG.
- Generate PNG/PDF in the isolated exporter.
- Add bounded preview thumbnails.

**Exit:** exported layouts match the interactive view within documented tolerances.

### Phase 5 — optional persistence

- Decide between no persistence, separate artifact storage, or an explicit Supabase Storage exception.
- Implement retention, ownership, authorization, and audit metadata.

**Exit:** private artifact access is tested end to end.

### Phase 6 — iTOL and scientific interoperability

- Add iTOL ZIP generation.
- Add opt-in Newick/Nexus/PhyloXML upload and preview.
- Only then consider external iTOL upload.

**Exit:** third-party transfer is explicit, scoped, and auditable.

## Proposed project structure

```text
apps/ambassador-tree/src/
  graph/
    visualization-graph.ts
    from-tree-node.ts
    validate.ts
    revision.ts
  layouts/
    genealogy.ts
    radial.ts
    rectangular-cladogram.ts
  annotations/
    rank.ts
    status.ts
    activity.ts
    volume.ts
  exports/
    contract.ts
    json.ts
    svg.ts
    worker-client.ts
  app/api/
    ambassador-tree/route.ts
    tree-export/route.ts

services/tree-exporter/
  exporter/
    adapters/
    formats/
    renderers/
    validation/
  fixtures/
```

Do not move the existing files all at once. Introduce these seams as features require them.

## Export contract

```ts
type ExportFormat =
  | 'json'
  | 'newick'
  | 'nexus'
  | 'phyloxml'
  | 'itol-zip'
  | 'svg'
  | 'png'
  | 'pdf';

interface ExportRequest {
  graphId: string;
  rootId: string | null;
  format: ExportFormat;
  layout?: LayoutMode;
  annotationSets: string[];
  privacyProfile: 'presentation' | 'operations' | 'full-admin';
  graphRevision: string;
}

interface ExportArtifact {
  format: ExportFormat;
  mediaType: string;
  filename: string;
  byteLength: number;
  sha256: string;
  graphRevision: string;
  exporterVersion: string;
}
```

Reject an export if the requested revision is stale. This prevents a topology file and its annotation tracks from representing different snapshots.

## Testing gates

### Structural

- exactly one root per exported tree (or one artifact per root);
- no unresolved parent;
- no cycle;
- all nodes reachable;
- deterministic sibling order;
- unique machine IDs;
- explicit policy for duplicate display names;
- finite numeric values;
- no mutation during normalization.

### Format

- Newick parsed back by Biopython and phylotree.js;
- Nexus parsed back independently;
- PhyloXML validated against its schema and parsed by Biopython;
- iTOL fixtures checked against the supported template grammar;
- XML/HTML/SVG injection fixtures;
- Unicode and quoting fixtures;
- zero values preserved.

### Product

- inspector and CRM deep links still work in every interactive layout;
- re-root/collapse/selection behavior is consistent;
- keyboard and screen-reader paths are retained;
- no PII in presentation exports;
- authorization tests for whole-network and subtree exports;
- current genealogy view remains the default until the new modes pass visual regression.

### Performance

- parsing, canonicalization, layout, SVG serialization, rasterization, and peak memory measured independently;
- automatic density mode or progressive rendering above a measured threshold;
- job timeout and cancellation;
- no recursive call-stack failure on a pathological deep chain.

## Changes recommended for `phylo-forge.skill` itself

Before this skill is used operationally:

1. Narrow its description to capabilities actually present, or implement the missing import/render/storage commands.
2. Split generic scientific guidance from XO Pure-specific policy.
3. Remove the default service-role recipe for XO Pure.
4. Replace the direct table fetch with an adapter contract.
5. Preserve zero values.
6. Make invalid support/color a blocking error for affected formats.
7. Make duplicate machine identifiers blocking for iTOL.
8. Stage and atomically publish export batches.
9. Add standard PhyloXML namespace/schema output and schema validation.
10. Add independent parser round trips.
11. Add limits, safe paths, deterministic sibling order, and provenance.
12. Use stable IDs for iTOL and separate display labels.
13. Add tests before treating its “hard rules” as enforced behavior.

## Final recommendation

Build the “incredible visualization” capability **inside the existing ambassador-tree service**, because the repository has already made the hard architectural choices correctly. Use phylogenetic formats and open-source libraries as adapters and accelerators around the existing business graph—not as a replacement data model.

The immediate build sequence should be:

1. versioned canonical DTO;
2. radial layout plus annotation tracks in the current React renderer;
3. deterministic JSON/SVG downloads;
4. isolated Biopython-backed Newick/Nexus/PhyloXML export;
5. private artifact persistence only after the storage-policy decision;
6. opt-in iTOL packages last.

This path is additive, feature-flag friendly, testable at every seam, and consistent with the repository's current read-only contract.
