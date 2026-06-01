# XO Pure CRM — Railway Deploy Audit & Findings (2026-05-31)

**Author:** Claude (read-only audit; no code edited)
**Scope:** Verify recent Grok CLI + Dockerfile work is committed, audit what changed, and
diagnose the current Railway build failure. **No edits were made to any source file** — this
document is the deliverable you asked for before any further changes.

---

## 0. TL;DR

1. **Your work is safe and pushed.** Working tree is clean; local `main` is even with
   `origin/main` (0 ahead / 0 behind) at `9dda2e969f`. Every Grok CLI + Dockerfile change is
   already committed to GitHub. Nothing is at risk of being lost.
2. **Big progress:** the deploy now **builds your custom `twenty-front` from source** (the new
   multi-stage `services/server/Dockerfile`). This fixes the old "production was just the stock
   `twentycrm/twenty:v0.32.0` image + a logo" problem — your dashboard code will finally ship.
3. **One thing is blocking the build, and it's a one-line fix.** The Dockerfile builder uses
   **Node 22**, but this repo **hard-requires Node `^24.5.0`**. `yarn install --immutable`
   runs a version constraint check and aborts. That is the *only* reason the last build failed.
4. **A second issue will surface *after* the build passes** (documented in §4) — the runtime is
   still the stock v0.32.0 **server**, so the `xopure:sync-standard-application` command and any
   newer GraphQL fields the fork's frontend expects are not guaranteed to be present.

---

## 1. Git / commit state (your top priority)

```
branch:            main  (tracking origin/main)
ahead / behind:    0 / 0
working tree:      clean (nothing uncommitted, nothing untracked)
HEAD:              9dda2e969f
remote:            https://github.com/MyBlockcities/Xopure_crm.git
```

Recent history (newest first):

| Commit | Summary |
|---|---|
| `9dda2e969f` | fix(docker): switch builder to **node:22-bookworm-slim** + canvas native deps |
| `ea20b01b3f` | chore(dashboard): fully disable Apollo in main landing + template instantiation |
| `eac8626c01` | fix(build): replace non-exported `IconTemplate` with exported icons |
| `f482436c12` | fix(build): correct Apollo Client import in `useInstantiateDashboardTemplate` |
| `8fe9249a40` | feat(railway + dashboards): proper custom frontend build + Mission Control landing |
| `8298d4fb8d` | chore(deploy): force rebuild to include `xopure:sync-standard-application` |
| `bb47d47b53` | feat(commands): `xopure:sync-standard-application` to backfill standard objects |
| `1bc90c673b` | feat(dashboards): "Create all dashboards" bulk seeding from gallery |

**Conclusion:** ✅ Everything you and Grok did is committed and on `origin/main`. No commit
action is required to preserve the work. (You *can* test the scripts as-is.)

---

## 2. What the new Dockerfile actually does (and why it's the right direction)

`railway.toml` → builds the web service from **`services/server/Dockerfile`**, a multi-stage build:

- **Builder stage** (`FROM node:22-bookworm-slim`):
  - `apt-get` installs the native toolchain for `canvas` (cairo, pango, jpeg, gif, rsvg, pixman, pkg-config) ✓
  - `COPY . .` → full monorepo ✓
  - `corepack enable && yarn install --immutable` ← **fails here** (see §3)
  - `npx nx build twenty-shared` then `npx nx build twenty-front --configuration=production`
- **Runtime stage** (`FROM twentycrm/twenty:v0.32.0`):
  - Copies the freshly built `packages/twenty-front/dist` over the stock frontend
  - Re-applies XO Pure branding (index.html, manifest, icons)

This is the correct architecture for shipping your custom **frontend**. The remaining gaps are
the build-blocker (§3) and the runtime-server gap (§4).

---

## 3. 🔴 ROOT CAUSE of the failed build — Node 22 vs required Node 24

From the Railway log, the build proceeds correctly through apt-get, `COPY . .`, dependency
resolution, fetch (+2.87 GiB, 4963 packages), and link — then dies at the very end of
`yarn install --immutable`:

```
➤ YN0000: ┌ Post-install validation
➤ YN0001: │ Error: Node version v22.22.3 doesn't match the required version, please use ^24.5.0
    at Object.constraints (/app/yarn.config.cjs:26:13)
➤ YN0000: · Failed with errors in 2m 43s
process "/bin/sh -c corepack enable && yarn install --immutable" did not complete successfully: exit code: 1
```

Why this is deterministic — three places in the repo pin Node 24:

| File | Constraint |
|---|---|
| `package.json` | `"engines": { "node": "^24.5.0" }` |
| `.nvmrc` | `24.5.0` |
| `yarn.config.cjs` (lines ~24-28) | `constraints()` throws if `process.version` doesn't satisfy `engines.node` |

`yarn install --immutable` executes `yarn.config.cjs` constraints during post-install
validation. On a **node:22** base, `process.version` = `v22.22.3`, which does **not** satisfy
`^24.5.0`, so the constraint throws and the install (and therefore the whole Docker build)
fails. **The Dockerfile can never succeed on Node 22 while the repo requires Node 24.**

> The Dockerfile comment (lines 32-41) reasons that Node 22 was chosen for reliable native
> `canvas` builds and that "Node 24 is still young." That tradeoff isn't available here: the
> repo's own constraints make 24 mandatory. The good news — the canvas concern is about
> **Alpine vs Debian**, not the Node major. `node:24-bookworm-slim` is still Debian Bookworm
> with the same apt-installed toolchain, so canvas will still compile.

### Recommended fix (one line, not yet applied)

```dockerfile
# services/server/Dockerfile, line 43
- FROM node:22-bookworm-slim AS builder
+ FROM node:24-bookworm-slim AS builder
```

(And update the explanatory comment block, lines 25-41, so it no longer says "Node 22 LTS"—
purely cosmetic.)

- **Why this is safe:** still Debian Bookworm → all the `libcairo2-dev` / `libpango1.0-dev` /
  etc. deps still apply; canvas still builds; and now `process.version` satisfies `^24.5.0`.
- **Alternative (NOT recommended):** loosen `engines.node` to allow 22. Rejected — the codebase
  is developed/tested on 24 (`.nvmrc` = 24.5.0); diverging the deploy runtime from dev invites
  subtle runtime bugs.

---

## 4. 🟠 Secondary issue that surfaces *after* the build passes

The runtime stage is `FROM twentycrm/twenty:v0.32.0` — the **stock upstream server**. This
Dockerfile only rebuilds and copies the custom **frontend** (`twenty-front/dist`); it does
**not** build the custom **`twenty-server`**. Consequences:

1. **`xopure:sync-standard-application` is NOT in the deployed image.** That command lives in
   `twenty-server` source, which this image doesn't compile. To provision the Dashboards
   standard object + nav menu item in production you must either:
   - keep running it **locally against the prod DB** (this already works — your Apple/YC
     workspaces synced), **or**
   - extend the Dockerfile to also build `twenty-server` from source (heavier; see §6 P1).
2. **Potential front/back version skew.** The frontend is built from the fork (newer
   `twenty-front`) but talks to a **v0.32.0** GraphQL server. If the fork's dashboard/page-layout
   widget code calls GraphQL fields/mutations that v0.32.0 doesn't expose, those calls fail at
   runtime even though the page renders. This needs a smoke test once it deploys.
   - *Mitigating factor:* recent commits (`ea20b01b3f`, `f482436c12`) deliberately disabled
     Apollo in the landing + template instantiation "for production stability," which suggests
     this skew was already being worked around. Worth confirming what that disables.

---

## 5. Other observations (not blockers)

- **Build weight/time:** install fetches **+2.87 GiB / 4963 packages** and compiles many native
  modules (sharp, canvas, swc, bcrypt, esbuild…). The Vite/Rollup production build of
  `twenty-front` is memory-hungry; on Railway you may need `ENV NODE_OPTIONS=--max-old-space-size=4096`
  (or larger) in the builder stage to avoid OOM during `nx build twenty-front`.
- **`.github/workflows/cd-deploy-main.yaml`** dispatches to `twentyhq/twenty-infra` (upstream's
  deploy infra) using a `TWENTY_INFRA_TOKEN` secret you don't own — it's effectively inert for
  this fork. Your real deploy path is Railway (auto-deploy on push to `main`, or `railway up`).
  Not harmful; just don't expect that workflow to do anything.
- **`DashboardTemplate.ts`** (the type you flagged) is clean and complete: supports
  `graph` (incl. `'gauge'` visualization), `recordTable`, and `frontComponent` widgets; objects
  referenced by singular name and resolved to metadata ids at instantiation, with unresolved
  widgets skipped gracefully. No issue here.
- **Supabase read-only law** is correctly enshrined in `CLAUDE.md`. Nothing in this audit or the
  proposed fix touches Supabase. ✅

---

## 6. Proposed next steps (prioritized)

| Pri | Action | Effort | Risk |
|---|---|---|---|
| **P0** | Change `services/server/Dockerfile` builder `FROM node:22-bookworm-slim` → `node:24-bookworm-slim`; push; let Railway rebuild. **Unblocks the build.** | 1 line | Low |
| P0.1 | (Optional, same commit) Add `ENV NODE_OPTIONS=--max-old-space-size=4096` before `nx build twenty-front` to pre-empt OOM. | 1 line | Low |
| **P1** | Once deployed: smoke-test the dashboard gallery → "Create all dashboards" against the v0.32.0 server. If widget/page-layout mutations 4xx/5xx, the **runtime server** must also be built from the fork (extend Dockerfile to build+run `twenty-server`, or base runtime on a fork-built server image). | Verify first | Med |
| **P1.1** | Get `xopure:sync-standard-application` into prod — either build `twenty-server` from source in this image, or keep running it locally against the prod DB (works today). | Med | Med |
| P2 | Confirm what `ea20b01b3f` ("fully disable Apollo in main landing + template instantiation") turns off, so dashboards still function end-to-end and aren't silently no-op. | Review | Low |
| P2.1 | Pin the runtime base and builder Node to exact tags (`node:24.5.0-bookworm-slim`, keep `twentycrm/twenty:v0.32.0`) for reproducibility. | 1 line | Low |

---

## 7. What I did NOT do (per your instruction)

- I did **not** edit the Dockerfile, `yarn.config.cjs`, `package.json`, or any other file.
- I did **not** revert or overwrite any of your or Grok's changes.
- I did **not** touch Supabase in any way.

**Awaiting your go-ahead** to apply the P0 one-line Dockerfile fix (node:22 → node:24), which is
the single change required to get the Railway build past the point where it currently fails.
