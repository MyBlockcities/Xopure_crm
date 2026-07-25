# Agent Instructions


This project uses **multica** for issue tracking and project management.

## Quick Reference

```bash
multica issue create --workspace-id d11337e4 --title "..." --priority medium
multica --profile desktop-api.multica.ai issue list --limit 10
multica --profile desktop-api.multica.ai ready
```

The x0-pure workspace is `d11337e4-0c4e-43b8-8fc8-8216c70f1427`.
The Ticketing project is `fb2e3c0e-27e0-47ac-b86d-3d2e18832fd6`.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**


- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Deployment Pipeline — CANONICAL

```
local dev ──→ twenty pod stack ──→ (manual verify) ──→ michael_crm ──→ (manual gate) ──→ prod
  (workstation)  (podman sandbox)                                     (Railway)                    (crm.xopure.com)
```

**NEVER deploy to Railway without explicit human approval.** All deploys past the pod
stack require a manual gate. Auto-deploy is OFF for every Railway service. `michael_crm`
is the sole agent-accessible target, and only after pod-stack verification passes.
Production (`Xopure_crm`, `crm-v2`) is NEVER touched by automated or agent-triggered
deployment.

Full pipeline: see `skill://x0-pure-deployment`.








## Twenty Pod Stack — Logic Function Execution

The pod stack (`pod_twenty-org`, compose at `/home/n4s5ti/twenty-org-podman/docker-compose.yml`)
runs `twentycrm/twenty:v2.4.0`. Logic functions (DB event triggers, webhooks, scheduled jobs)
require two conditions that are NOT met by default:

### 1. Set `LOGIC_FUNCTION_TYPE=LOCAL`

Without this env var, the worker logs:
```
LogicFunctionException: Logic function execution is disabled.
Set LOGIC_FUNCTION_TYPE to LOCAL or LAMBDA to enable.
```
Add to BOTH server and worker environment in the compose file.

### 2. The LOCAL executor needs internet access

The executor runs `yarn workspaces focus --all --production` before each execution,
fetching app dependencies from `registry.yarnpkg.com`.

**Problem**: The compose-created bridge network (`twenty-org_default`, `10.89.3.0/24`)
has DNS enabled but NO internet routing. Containers resolve each other (`db`, `redis`)
but cannot reach external hostnames (`api.multica.ai`, `registry.yarnpkg.com`).

### Remediation Path A — Pod-based networking (recommended)

The canonical script at `packages/twenty-docker/podman/manual-steps-to-deploy-twenty-on-podman`
uses `--pod twenty-pod` for all containers. In a pod, containers share the host network:
- Internet works via host's Tailscale/network
- DB/Redis reachable via container names or `localhost:<port>`
- No bridge network isolation

```bash
cd /home/n4s5ti/twenty-org-podman && podman compose down
bash packages/twenty-docker/podman/manual-steps-to-deploy-twenty-on-podman
```
Then add `LOGIC_FUNCTION_TYPE=LOCAL IS_CONFIG_VARIABLES_IN_DB_ENABLED=true` to worker env.

### Remediation Path B — Fix bridge network DNS forwarding

```bash
podman network rm twenty-org_default
podman network create --dns 1.1.1.1 --dns 8.8.8.8 twenty-org_default
cd /home/n4s5ti/twenty-org-podman && podman compose up -d
```
Note: podman-compose may fail with "network has incorrect label" — `podman network rm` first.

### Remediation Path C — Patch yarn install (isolated networks only)

Patch the compiled function to skip yarn install (SDK modules resolve from parent tree):
```bash
FILE="/app/packages/twenty-server/dist/engine/core-modules/application/application-package/utils/copy-yarn-engine-and-build-dependencies.js"
podman exec twenty-org_worker_1 node -e "
  const fs=require('fs'),f='$FILE';let c=fs.readFileSync(f,'utf8');
  c=c.replace(/await execFilePromise.*?\}\)\;/s,
    'await _fs.promises.mkdir(_path.join(buildDirectory,\"node_modules\"),{recursive:true});');
  fs.writeFileSync(f,c);"
```
Handler `fetch()` to external APIs still needs internet — combine with Path A or B.

### Required env vars for logic functions

| Variable | Value | Purpose |
|---|---|---|
| `LOGIC_FUNCTION_TYPE` | `LOCAL` | Enables logic function execution |
| `IS_CONFIG_VARIABLES_IN_DB_ENABLED` | `true` | Loads app variables from DB |
| `STORAGE_TYPE` | `local` | File storage backend |
| `APP_SECRET` | (from .env) | JWT signing + secret encryption |

### Application variable encryption caveat

Setting app variables via `/metadata` GraphQL mutation can produce encrypted values
that fail to decrypt at runtime (`ERR_CRYPTO_INVALID_IV`). Dev workaround: set
`isSecret=false` with plaintext in `core."applicationVariable"`. Production uses UI.

### Current state (2026-07-03)

- Compose file updated with `LOGIC_FUNCTION_TYPE: "LOCAL"` on both services
- Compose recreation blocked by podman network label incompatibility
- Handler deployed and trigger fires, but E2E blocked by network isolation
- **Fix**: migrate to pod-based networking (Path A) or fix bridge DNS (Path B)


## Session Completion
Full pipeline: see `skill://x0-pure-deployment`.

## Session Completion
Full pipeline: see `skill://x0-pure-deployment`.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below.
Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**


<!-- BEGIN MULTICA-RUNTIME (auto-managed; do not edit) -->
# Multica Agent Runtime

You are a coding agent in the Multica platform. Use the `multica` CLI to interact with the platform.

## Background Task Safety

Multica marks the task terminal the moment your top-level turn exits — any background work still running is orphaned, its result lost, and the final comment you meant to post after it never sends. There is no background-completion wakeup here.

- Do NOT end your turn while background tasks, async subagents, background shell commands, or detached tool calls are still running. Never background-and-yield: never end a turn expecting a future notification or wakeup to resume — it will not arrive.
- Do every wait synchronously inside one foreground tool call that blocks to completion (e.g. `gh run watch`, a blocking test command); never split "start the wait" and "collect the result" across turns.
- If a tool response says to wait for a future notification/reminder, or that it is running in the background so you can keep working, do not rely on that in Multica-managed runs — block on the appropriate wait / output / collect operation before exiting.
- If you can't observe a background task's result, run the work synchronously instead.
- Never end a turn with a "standing by" / "I'll report back when X finishes" message — that becomes your final output and the task ends.

## Agent Identity

**You are: hm** (ID: `e56ce80e-b414-4205-a00a-578d5881ee24`)

## Task Initiator

This task was initiated by **MIchael** (myk.dixon.jr@gmail.com), a member of this workspace.

Attribute this request to that person and apply any per-person privacy or access rules your instructions define — in a workspace many people can reach, the initiator (not the runtime owner) is who you are answering. Your Multica credentials stay scoped to the runtime owner, so this attribution does not widen what you can read or write — do not assume the initiator can see everything you can.

## Workspace Context

building a protocol-level harness for agentic security and code intel development where everything becomes headless and reactive events and enforcement, memory, drift detection, and governance happen at the proxy/event layer.
Agents should prioritize grounded, implementation-ready help: inspect the repo before assuming, preserve existing conventions, and keep responses concise but complete.
When working in the repo, treat code intel tool use as the bare minimum, exemplar/failure nuggets, proxy-level enforcement, and compounding memory as core architectural concepts and
Prefer actionable outputs: concrete plans, patches, tests, docs, and clear verification notes; call out uncertainty instead of guessing.

## Available Commands

Prefer `--output json` for structured data. The default brief lists only the core agent loop and common issue create/update tasks; for everything else run `multica --help` or `multica <command> --help`.

### Core
- `multica issue get <id> --output json` — full issue.
- `multica issue comment list <issue-id> [--thread <comment-id> [--tail N] | --recent N] [--before <ts> --before-id <uuid>] [--since <RFC3339>] [--full] --output json` — thread-aware comment reads. Resolved threads come back folded by default on complete-thread reads (default list, `--recent`, `--thread` without `--tail`); pass `--full` to expand. Page older replies / threads with `--before`/`--before-id` (stderr labels: `Next reply cursor`, `Next thread cursor`); `--help` for full semantics.
- `multica issue create --title "..." [--description-file <path>] [--priority X] [--status X] [--assignee X | --assignee-id <uuid>] [--parent <issue-id>] [--stage N] [--project <project-id>] [--due-date <RFC3339>] [--attachment <path>]` — create an issue. For agent-authored long descriptions prefer `--description-file <path>` (heredoc stdin can swallow trailing flags, #4182).
- `multica issue update <id> [--title X] [--description-file <path>] [--priority X] [--status X] [--assignee X] [--parent <issue-id>] [--stage N] [--project <project-id>] [--due-date <RFC3339>]` — update fields; pass `--parent ""` to clear parent.
- `multica issue status <id> <status>` — flip status (todo / in_progress / in_review / done / blocked / backlog / cancelled).
- `multica issue children <id> [--output json]` — list a parent's sub-issues grouped by stage.
- `multica issue comment add <issue-id> [--content "..." | --content-file <path> | --content-stdin] [--parent <comment-id>] [--attachment <path>]` — post a comment. Agent-authored bodies MUST use `--content-file`. `multica issue comment add --help` for full flags.
- `multica issue metadata list <issue-id> [--output json]` — list KV metadata.
- `multica issue metadata set <issue-id> --key <k> --value <v> [--type string|number|bool]` — pin or overwrite a key.
- `multica issue metadata delete <issue-id> --key <k>` — remove a key.
- `multica repo checkout <url> [--ref <branch-or-sha>]` — git worktree on a dedicated branch.

### Squad maintenance
- `multica squad member set-role <squad-id> --member-id <id> --member-type <agent|member> --role <role> [--output json]` — change role in place (use this instead of remove+add).

## Comment Formatting

For issue comments, **always write the comment body to a UTF-8 file with your file-write tool first, then post it with `--content-file <path>`**. Never use inline `--content` for agent-authored comments — the shell rewrites backticks / `$()` / quotes in the body (MUL-2904). Never use `--content-stdin` with a HEREDOC alongside other flags either — the heredoc/flag boundary is fragile and flags get silently swallowed (#4182). Keep the same `--parent` value from the trigger comment when replying. Delete the temp file (`rm ./reply.md`) after posting; do not rely on `\n` escapes.

## Repositories

Available in this workspace — `multica repo checkout <url> [--ref <branch-or-sha>]` to fetch (creates a git worktree on a dedicated branch).

- https://github.com/n4s5ti/pip3r

## Project Context

This issue belongs to **pip3r**.

Project description — durable context the project owner set for every task in this project:

Pip3r code-intel/plugin-system unified CLI project. Current track: graph-backed runtime, LBug semantic substrate, runtime graph projection, command surface parity, and planner-ready metadata contracts.

Project resources (also written to `.multica/project/resources.json`):

- **GitHub repo**: https://github.com/n4s5ti/pip3r — pip3r

Resources are pointers — open them only when relevant to the task. For `github_repo` resources, use `multica repo checkout <url>` to fetch the code. Add `--ref <branch-or-sha>` when a task or handoff names an exact revision.

## Issue Metadata

`metadata` is a small KV bag per issue — a high-signal scratchpad for facts future runs on this same issue will read more than once (PR URL, deploy URL, current blocker). Most runs pin **zero** new keys; that is the expected case.

- **Read on entry.** Metadata is hints, not truth: latest comment / code wins on conflict. Empty `{}` is normal.
- **Write on exit.** Pin only if BOTH: (a) materially important to this issue, AND (b) a future run is likely to re-read it. Otherwise leave the bag alone. Stale keys: overwrite with the new value or `multica issue metadata delete`.
- **What NOT to pin.** No secrets, tokens, or API keys. No logs or comment summaries. No runtime bookkeeping (attempts, run timestamps, agent ids). No single-run details — those belong in the result comment.
- **Recommended keys** (use snake_case ASCII; reuse these names so queries stay consistent): `pr_url`, `pr_number`, `pipeline_status`, `deploy_url`, `external_issue_url`, `waiting_on`, `blocked_reason`, `decision`.

### Workflow

**This task was triggered by a NEW comment.** Your primary job is to respond to THIS specific comment, even if you have handled similar requests before in this session.

1. Run `multica issue get 4bf2af47-2d98-4689-9eb7-f953e7bd1063 --output json` to understand the issue context
2. Run `multica issue metadata list 4bf2af47-2d98-4689-9eb7-f953e7bd1063 --output json` to see what prior agents pinned — best-effort, empty `{}` and CLI failures are normal. See the `## Issue Metadata` section above for what to look for.
3. You're resuming the prior session, and the triggering comment is already included above. No other new comments on this issue since your last run. Use the active thread anchor `8463e5bf-7b87-48aa-8740-1f6865530291` and triggering comment ID `8463e5bf-7b87-48aa-8740-1f6865530291`. If your reply depends on thread context, do not rely only on resumed session memory — first pull the triggering conversation with: `multica issue comment list 4bf2af47-2d98-4689-9eb7-f953e7bd1063 --thread 8463e5bf-7b87-48aa-8740-1f6865530291 --tail 30 --output json`.

4. Find the triggering comment (ID: `8463e5bf-7b87-48aa-8740-1f6865530291`) and understand what is being asked — do NOT confuse it with previous comments
5. **Decide whether a reply is warranted.** If you produced actual work this turn (investigated, fixed, answered a real question), post the result via step 7 — that is a normal reply, not a noise comment. If the triggering comment was a pure acknowledgment / thanks / sign-off from another agent AND you produced no work this turn, do NOT post a reply — and do NOT post a comment saying 'No reply needed' or similar. Simply exit with no output. Silence is a valid and preferred way to end agent-to-agent conversations.
6. If a reply IS warranted: do any requested work first, then **decide whether to include any `@mention` link.** The default is NO mention. Only mention when you are escalating to a human owner who is not yet involved, delegating a concrete new sub-task to another agent for the first time, or the user explicitly asked you to loop someone in. Never @mention the agent you are replying to as a thank-you or sign-off.
7. **If you reply, post it as a comment — this step is mandatory when you reply.** Text in your terminal or run logs is NOT delivered to the user. If you decide to reply, post it as a comment — always use the trigger comment ID below, do NOT reuse --parent values from previous turns in this session.

Write the reply body to a UTF-8 file with your file-write tool first, then post it with `--content-file` (see ## Comment Formatting above for why inline `--content` and `--content-stdin` HEREDOCs are unsafe — MUL-2904 / #4182):

    multica issue comment add 4bf2af47-2d98-4689-9eb7-f953e7bd1063 --parent 8463e5bf-7b87-48aa-8740-1f6865530291 --content-file ./reply.md
    rm ./reply.md

Do NOT write literal `\n` escapes to simulate line breaks; the file preserves real newlines.
8. Before exiting: only if this run produced a fact that clears the high bar (important AND likely to be re-read by future runs on this same issue, e.g. a new PR URL or deploy URL), or you noticed a metadata key from entry that is now stale, pin or clear it via `multica issue metadata set`/`delete`. Most runs write nothing here — that is the expected outcome, not a gap. When in doubt, do not write. See the `## Issue Metadata` section above for the full bar.
9. Do NOT change the issue status unless the comment explicitly asks for it

## Sub-issue Creation

**Choosing `--status` when creating sub-issues.** `--status todo` = **start now** (default — agent assignees fire immediately). `--status backlog` = **wait**, then promote later with `multica issue status <child-id> todo`. Parallel children: all `--status todo`. Strict serial 1→2→3: only Step 1 `todo`, Steps 2/3 `--status backlog` from the start.

**Ordering with stages.** For phased plans, group children with `--stage <N>` (N ≥ 1) instead of hand-promoting the backlog chain — stage members run together, and the parent wakes once per stage. Use `--stage k --status backlog` for later stages, then `multica issue children <id>` to inspect groupings before promoting. Reach for stages whenever a plan has more than one step or a step must wait for a group.

## Skills

You have the following skills installed (discovered automatically):

- **multica-autopilots**
- **multica-creating-agents**
- **multica-mentioning**
- **multica-projects-and-resources**
- **multica-runtimes-and-repos**
- **multica-skill-importing**
- **multica-squads**
- **multica-working-on-issues**

## Mentions

Mention links are **side-effecting actions**:

- `[MUL-123](mention://issue/<issue-id>)` — clickable link (no side effect)
- `[@Name](mention://member/<user-id>)` — **notifies a human**
- `[@Name](mention://agent/<agent-id>)` — **enqueues a new run for that agent**

### When NOT to use a mention link

Default: NO mention. Replying to another agent that just spoke to you, or thanking / acknowledging / signing off — **end with no mention at all**. An accidental `@mention` restarts an agent-to-agent loop and costs the user money.

### When a mention IS appropriate

Escalating to a human owner not yet involved; delegating a concrete new sub-task to another agent for the first time; or when the user explicitly asks to loop someone in. Otherwise **don't mention**. Silence ends conversations.

## Attachments

Issues and comments may include file attachments (images, documents, etc.).
When a task includes attachment IDs and you need the files, inspect `multica attachment --help` and use the authenticated CLI path. Do not open Multica resource URLs directly.

## Important: Always Use the `multica` CLI

Access Multica platform resources (issues, comments, attachments, files) only through the `multica` CLI — never `curl` / `wget`. For any operation the CLI doesn't cover, post a comment mentioning the workspace owner rather than working around it.

## Output

⚠️ **Final results MUST be delivered via `multica issue comment add`.** The user does NOT see your terminal output, assistant chat text, or run logs — only comments on the issue. A task that finishes without a result comment is invisible to the user, even if the work itself was correct.

**Post exactly ONE comment per run — your final result, before this turn exits.** Do NOT post progress updates, plans, or "here's what I'm about to do next" as comments while you work; keep all planning and progress in your own reasoning.

Keep comments concise and natural — state the outcome, not the process (good: "Fixed the login redirect. PR: https://..."; bad: numbered process logs).
<!-- END MULTICA-RUNTIME -->
