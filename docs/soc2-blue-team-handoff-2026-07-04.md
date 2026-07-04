# SOC 2 Red/Blue Team Handoff — 2026-07-04

## Readiness

Blue team is ready for an initial compliance-sniffer pass after the current X0-148 OTEL config commit is pushed.

Readiness level: 7/10.

What is ready:
- SOC 2-ready schema validation exists for `audit_event`, `rbac_decision`, `ledger_entry`, and `claim_review`.
- Runtime producers exist for audit/RBAC/claim-review events and ledger-entry events.
- Deterministic redaction, hashing, and previous-hash chaining exist in the SOC 2 emitter/outbox layer.
- Targeted SOC 2 vitest suites were green in the prior parity pass.
- Local-dev OTEL metrics flow to the Hetz Grafana/Alloy stack; the repo podman compose now has matching local-dev OTEL wiring.

Not ready / high-value red-team targets:
- The SOC 2 outbox is in-memory only; durable storage, replay, and gap detection are not implemented.
- Only four schema classes are implemented. Missing from the SOC2 reference scope: `comp_calculation_event`, `payout_manifest`, `data_access_event`, and `product_quality_event`.
- The Comp AI compliance validator/sniffer is not in this repo. Treat it as an external tool and point it at this repo plus `/home/n4s5ti/Documents/dev/comp/` if that runtime owns the validator.
- Current OpenTelemetry metrics arrive in Hetz Prometheus, but service identity currently shows as `unknown_service:*`; Twenty's custom `MeterProvider` does not appear to apply `OTEL_SERVICE_NAME` / `OTEL_RESOURCE_ATTRIBUTES` to exported metrics.
- Do not call this SOC 2 compliant, certified, or audited. Use `SOC 2-ready` or `SOC 2-aligned` until an auditor issues a report.

## Context reset recommendation

Yes: reset context after this handoff and the current commit/update are complete.

Reason: the active transcript includes multiple mixed lanes: X0-148 OTEL wiring, X0-152 typecheck cleanup, X0-153/154/155 SOC 2 parity, and the red/blue-team setup. A fresh blue-team pass should start from durable artifacts instead of replaying this chat.

Fresh-agent bootstrap:
1. Read `vault://obsidian-library/SOC2/soc2-ref-mvp.md`.
2. Read this file.
3. Inspect these repo files:
   - `packages/twenty-apps/internal/xopure-crm/src/compliance/soc2-schema-validation.ts`
   - `packages/twenty-apps/internal/xopure-crm/src/compliance/soc2-event-emitter.ts`
   - `packages/twenty-apps/internal/xopure-crm/src/compliance/soc2-event-outbox.ts`
   - `packages/twenty-apps/internal/xopure-crm/src/logic-functions/twenty-sync-audit-event.database-event.logic-function.ts`
   - `packages/twenty-apps/internal/xopure-crm/src/logic-functions/handlers/supabase-sync-webhook-handler.ts`
   - `packages/twenty-docker/podman/podman-compose.yml`
   - `.env.xopure.example`
4. Load Multica X0 workspace state:
   - `multica --profile desktop-api.multica.ai --workspace-id d11337e4-0c4e-43b8-8fc8-8216c70f1427 issue get X0-100 --output json`
   - `multica --profile desktop-api.multica.ai --workspace-id d11337e4-0c4e-43b8-8fc8-8216c70f1427 issue list --project 2ecceb3e-3e1c-498d-b05a-a057f56bbe89 --status in_progress --output json`

## Blue-team first pass

Goal: make the system defensible against the first compliance-sniffer pass, not perfect.

Recommended checks:
- Validate all current SOC 2 schemas reject missing required evidence fields.
- Validate producers cannot override emitter-owned fields: `producer`, `environment`, `ingested_at_utc`, `event_hash`, `previous_event_hash`, `schema_valid`, `validation_errors`, and `quarantine_reason`.
- Validate sensitive fields are redacted before hashing/output.
- Validate ledger events enforce XO Pure invariants: integer cents, distinct buyer/recipient, valid status/pay area, stored classification, and reverse/reissue lineage.
- Validate claim reviews enforce disclosure/substantiation gates for wellness, income, product, testimonial, and education claims.
- Validate events have an explicit failure path when schema validation fails; no silent success on invalid compliance evidence.

Useful targeted commands from the xopure-crm package directory:

```bash
yarn vitest run -c vitest.unit.config.ts src/compliance/soc2-schema-validation.spec.ts src/compliance/soc2-event-emitter.spec.ts src/compliance/soc2-ledger-adapter.spec.ts src/logic-functions/twenty-sync-audit-event.database-event.logic-function.spec.ts
```

For repo-level config only:

```bash
podman compose -f packages/twenty-docker/podman/podman-compose.yml config
```

## Red-team target list

Attack these before the external validator does:
1. In-memory outbox can lose evidence on process restart.
2. No immutable archive/write-ahead log for emitted SOC 2 records.
3. No replay tool that proves a hash chain from genesis to current head.
4. No pipeline health event proving Alloy/Loki/Tempo/Prometheus accepted evidence.
5. `OTEL_SERVICE_NAME` is documented but currently not visible in Prometheus labels.
6. Missing schemas for payout manifests, data access, product quality, and comp calculations.
7. Claim review schema has core fields but no external substantiation artifact verification.
8. Compliance failures can still be logged to console without durable operator notification.
9. Current language must stay `SOC 2-ready` / `SOC 2-aligned`; any stronger claim is unsafe.

## Do not

- Do not deploy to Railway or production without explicit human approval.
- Do not modify unrelated uncommitted WIP while preparing the blue-team pass.
- Do not assume the Comp AI validator exists in this repo.
- Do not call XO Pure SOC 2 certified/audited/compliant.
- Do not use production secrets or paste Tailnet/API credentials into docs or comments.
