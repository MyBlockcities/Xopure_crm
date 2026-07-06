// ---------------------------------------------------------------------------
// SOC2 event emitter — redact, validate, hash, outbox
// ---------------------------------------------------------------------------

import type { Soc2SchemaName, Soc2ValidationResult } from './soc2-schema-validation';
import { validateSoc2Record } from './soc2-schema-validation';
import { redactRecord } from './soc2-redaction';
import type { Soc2EmittedRecord } from './soc2-event-outbox';
import { getDefaultOutbox, Soc2EventOutbox } from './soc2-event-outbox';
import { computeEventHash } from './soc2-event-hash';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface EmitSoc2EventParams {
  /** The schema to validate against. */
  schemaName: Soc2SchemaName;
  /** Domain data supplied by the producer (must include schema-required fields). */
  record: Record<string, unknown>;
  /** Override the emitter-owned producer value. Defaults to 'xopure-crm'. */
  producer?: string;
  /** Override the emitter-owned environment value. Defaults to 'development'. */
  environment?: string;
  /** Override the timestamp. Defaults to `new Date()`. */
  now?: Date;
  /** Override the default outbox (useful for testing or shared outbox). */
  outbox?: Soc2EventOutbox;
}

export interface EmitSoc2EventResult {
  /** The final emitted record with all envelope fields and hashes. */
  record: Soc2EmittedRecord;
  /** Validation outcome from `validateSoc2Record`. */
  validation: Soc2ValidationResult;
}

/**
 * Redact, validate, hash, and enqueue a SOC2 event.
 *
 * The emitter owns the following envelope fields and replaces any producer-
 * supplied values for them:
 *   ingested_at_utc, producer, environment, event_hash,
 *   previous_event_hash, schema_valid, validation_errors, quarantine_reason
 *
 * Domain fields (actor, resource, decision, claim, ledger, etc.) MUST be
 * supplied by the caller in `record`.
 */
export function emitSoc2Event(params: EmitSoc2EventParams): EmitSoc2EventResult {
  const {
    schemaName,
    record,
    producer = 'xopure-crm',
    environment = 'development',
    now = new Date(),
    outbox = getDefaultOutbox(),
  } = params;

  // 1. Redact sensitive values first
  const redacted = redactRecord(record) as Record<string, unknown>;

  // 2. Apply envelope fields (emitter-owned — always overwrites)
  const ingestedAtUtc = now.toISOString();
  const envelope = {
    ingested_at_utc: ingestedAtUtc,
    producer,
    environment,
    schema_valid: true,          // placeholder (overwritten after validation)
    event_hash: 'pending',       // placeholder for validation
    previous_event_hash: 'genesis', // placeholder for validation (non-empty to pass required-string check)
  };

  // 3. Merge for validation
  const recordForValidation: Record<string, unknown> = {
    ...redacted,
    ...envelope,
  };

  // 4. Validate
  const validation = validateSoc2Record(schemaName, recordForValidation);

  // 5. Apply schema_valid / validation_errors / quarantine_reason
  if (!validation.success) {
    recordForValidation.schema_valid = false;
    recordForValidation.validation_errors = validation.errors ?? [];
    recordForValidation.quarantine_reason =
      `Validation failed: ${(validation.errors ?? []).join('; ')}`;
  } else {
    recordForValidation.schema_valid = true;
  }

  // 6. Hash the record WITHOUT hash fields (computeEventHash excludes them)
  const eventHash = computeEventHash(recordForValidation);

  // 7. Chain from outbox
  const previousHash = outbox.lastHash() ?? 'genesis';

  // 8. Build final record
  const finalRecord: Soc2EmittedRecord = {
    ...recordForValidation,
    event_hash: eventHash,
    previous_event_hash: previousHash,
  };

  // 9. Enqueue
  outbox.enqueue(finalRecord);

  return { record: finalRecord, validation };
}
