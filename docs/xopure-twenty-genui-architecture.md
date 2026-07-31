# XO Pure composable GenUI architecture

Status: accepted for the Twenty application boundary. Related issues: OBS-1525 through OBS-1530. Visual map: `docs/xopure-twenty-genui-pipeline.html`.

## Decision

XO Pure generative UI is an application-owned composition runtime. Twenty remains the host for native chat, tool execution, application metadata, Remote DOM rendering, and side-panel navigation. XO Pure owns a versioned declarative composition schema, an allowlisted template catalog, validation, persistence, and one generic renderer front component.

No generated JavaScript, JSX, raw HTML, arbitrary CSS, arbitrary URL, or direct host API call is accepted as composition data. No Twenty core file is modified.

## Grounded Twenty contracts

| Contract | Current source authority | Decision |
|---|---|---|
| Native AI transport | `packages/twenty-shared/src/ai/types/ExtendedUIMessage.ts` — `ExtendedUIMessage` extends Vercel AI SDK `UIMessage`; `DataMessagePart.ts` defines the closed Twenty data-part map | Do not invent an app chat-part protocol. App tools return structured results through the existing tool surface. |
| App AI tools | `packages/twenty-server/src/engine/core-modules/tool-provider/providers/logic-function-tool.provider.ts` — logic functions with `toolTriggerSettings` become `app_*` tools; `tool-output.type.ts` defines result and record-reference envelopes | Composition creation is a strict logic-function tool. It returns a stable composition record reference, not UI code. |
| Skills | `packages/twenty-sdk/src/sdk/define/index.ts` exports `defineSkill`; app skills are discovered from `src/skills/*.skill.ts` | Skills teach the agent the schema, recipes, and policy; they do not render UI. |
| App objects | `packages/twenty-sdk/src/sdk/define/objects/define-object.ts` and `fields/field-type.ts`; `FieldMetadataType` includes `RAW_JSON` | Persist validated documents in an app-owned `xopureUiComposition` record with a `RAW_JSON` document field. |
| RAW_JSON validation | `packages/twenty-server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-raw-json-field-or-throw.util.ts` | Persist only a non-array object. The app validator applies the stronger composition contract before mutation. |
| App persistence | `twenty-client-sdk/core` `CoreApiClient`; existing app pattern in `xopure-crm/src/supabase-sync/utils/upsert-twenty-record.ts` | Logic functions query/mutate the app object with the injected app access token. No direct database writes. |
| Front components | `packages/twenty-sdk/src/sdk/define/front-component/define-front-component.ts`; `packages/twenty-front-component-renderer/src/remote/worker/utils/renderFrontComponent.ts` | One app front component renders the document through Remote DOM. |
| Remote DOM allowlist | `packages/twenty-front-component-renderer/src/remote/generated/remote-elements.ts`; deny list in `host/utils/createFallbackComponentRegistry.ts` | Use supported HTML/SVG primitives and inline style strings. Never depend on canvas, WebGL, script/style/link/meta tags, custom elements, portals, direct DOM measurement, storage, or arbitrary browser globals. |
| Record context | `packages/twenty-sdk/src/sdk/front-component/types/FrontComponentExecutionContext.ts`; `useRecordId.ts` derives a record only when exactly one ID is selected | The renderer accepts one composition record ID. It knows the fixed app object name; it does not infer object metadata from context. |
| Initial panel | `packages/twenty-sdk/src/sdk/define/command-menu-items/define-command-menu-item.ts`; `HeadlessFrontComponentRendererEngineCommand.tsx` mounts the command front component | A command/front component opens the initial composition panel. Server-side AI tools cannot call host UI APIs. |
| Nested panel | `packages/twenty-sdk/src/sdk/front-component/functions/openSidePanelPage.ts`; `SidePanelPages.ViewFrontComponent` parameters in `globals/frontComponentHostCommunicationApi.ts`; host dispatch in `packages/twenty-front/src/modules/front-components/hooks/useFrontComponentExecutionContext.ts` | Twenty v2.4.0 exposed only a generic page-navigation call and never populated the child front-component instance state, which explained the blank body. Host commit `5242ddf458` adds the typed `ViewFrontComponent` dispatch through `useOpenFrontComponentInSidePanel`, including explicit record context. Catalog 1.1 enables `open-composition` only for hosts containing that contract. |
| Sandbox/network | `remote/sandbox/utils/createFrontComponentSandboxIframe.ts` uses `sandbox="allow-scripts"`; `host/utils/createHostFetchEnforcingPolicy.ts` enforces configured origins | Fetch only through supported SDK/client bridges. Show bounded loading/error states and fail closed on policy rejection. |
| Native verification | `twenty-sdk` CLI commands `typecheck`, `build`, and `dev --once` | Every change passes typecheck/build; runtime releases also pass live app sync and browser proof. |

## Composition lifecycle

1. Native Twenty chat receives the request.
2. XO Pure skills provide dashboard recipes, compensation semantics, and composition policy.
3. The agent chooses native dashboard tools for normal dashboard metadata or the XO Pure composition tool for a richer side-panel view.
4. The logic-function handler validates an unknown input against schema version 1, the template catalog, size limits, data-binding rules, and capabilities.
5. The handler persists the canonical document as an `xopureUiComposition` record through `CoreApiClient` and returns its record ID/reference.
6. The user opens the initial panel through the app command/launcher. The mounted launcher calls `openSidePanelPage` with `ViewFrontComponent`.
7. The renderer loads the composition record by ID, validates it again, and maps every block type to an allowlisted Remote DOM renderer.
8. Record links and nested compositions use the supported side-panel APIs only after authorization-aware record preflight. A nested composition must be a readable `READY` `xopureUiComposition`; the renderer then reuses its mounted front-component runtime ID with explicit object and record context (never the manifest universal identifier).

Server tools never claim to open a side panel directly. Tool completion and UI opening are separate supported actions.

## Schema version 1

A composition is a non-array JSON object with:

- `schemaVersion`: exactly `1`.
- `catalogVersion`: exactly the installed catalog version.
- `title`: 1–120 plain-text characters.
- `layout`: bounded column count and gap token.
- `blocks`: 1–40 ordered blocks with unique stable IDs.
- `provenance`: creator/tool identity and creation timestamp.

Each block has `id`, `type`, `version`, optional `title`, and type-specific data/config. Version 1 block types are:

- `kpi`: plain label/value/detail.
- `chart`: bounded SVG bar/line data; no arbitrary SVG markup.
- `table`: bounded columns/rows of scalar display values.
- `timeline`: bounded timestamp/title/detail entries.
- `alert`: severity plus plain title/message.
- `markdown`: markdown source rendered as plain safe text until an approved parser exists; raw HTML is rejected.
- `action`: allowlisted action identifier and typed parameters.
- `record-link`: explicit `recordId`, `objectNameSingular`, and label.

## Capabilities and limits

Capabilities are catalog-owned, never author-defined. Version 1 permits only:

- `record.read` for the fixed composition record.
- `record.open` with explicit allowlisted object and record identity.
- `panel.open-composition` with one explicit readable `READY` composition record.
- `navigation.internal` for allowlisted Twenty application paths.

`panel.open-composition` is available in catalog 1.1 on hosts containing Twenty commit `5242ddf458` or its equivalent typed `ViewFrontComponent` dispatch. Twenty v2.4.0 remains unsupported for nested composition panels and must fail the release compatibility gate rather than silently rendering a blank child.

Defaults: maximum 40 blocks, no inline composition embedding, one explicit composition target per nested-panel action, 12 table columns, 100 table rows, 100 chart points, 100 timeline entries, 64 KiB serialized document, and 120 characters per title. Unknown keys, versions, templates, capabilities, actions, URL schemes, and oversized values fail validation. Secrets and application-variable values are never serializable composition data.

## Trust boundary

Untrusted: model output, tool input, persisted RAW_JSON, labels, record IDs, object names, URLs, and data-binding results.

Trusted only after validation: catalog definitions compiled with the app, canonical composition documents, fixed renderer dispatch, explicit action handlers, and SDK host responses.

The renderer validates after load even when the creation handler already validated. It never evaluates strings as code, never spreads unknown properties into Remote DOM elements, never maps arbitrary event names, and never interpolates raw HTML. An invalid document renders a stable error receipt with no fallback renderer.

## Upgrade and release gates

For every Twenty upgrade:

1. Confirm the cited SDK exports and `SidePanelPages.ViewFrontComponent` parameter contract.
2. Confirm `FrontComponentExecutionContext` record behavior.
3. Diff the Remote DOM element/event allowlist and iframe/fetch policy.
4. Confirm logic-function tool discovery and `ToolOutput`/record-reference behavior.
5. Run native app typecheck/build/sync.
6. Browser-smoke composition load, every template, initial opening, nested opening, malformed documents, unauthorized records, and blocked URLs. If the host lacks the specialized `ViewFrontComponent` dispatch or nested opening regresses to a blank child/host crash, block release of catalog 1.1.

Any changed contract blocks release until this decision record and the application implementation agree.

## Explicit non-goals

- No A2UI, AG-UI, Open-UI, MCP Apps, or CopilotKit compatibility claim.
- No app-defined native chat renderer.
- No generated executable UI.
- No direct database persistence.
- No Twenty-core patch, alias, shim, or private host API.
