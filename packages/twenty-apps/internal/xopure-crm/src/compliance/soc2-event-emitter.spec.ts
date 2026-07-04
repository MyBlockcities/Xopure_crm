import { describe, expect, it } from 'vitest';

import { emitSoc2Event } from './soc2-event-emitter';
import { Soc2EventOutbox } from './soc2-event-outbox';
import { REDACTED_MARKER } from './soc2-redaction';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2026-07-04T12:00:00Z');

function validAuditEvent(): Record<string, unknown> {
  return {
    retention_class: 'standard',
    redaction_class: 'internal',
    schema_version: '1.0',
    event_id: 'evt-001',
    event_type: 'access',
    occurred_at_utc: '2026-07-04T12:00:00Z',
    actor_id: 'user-42',
    actor_role: 'admin',
    action: 'read',
    resource_type: 'report',
    resource_id: 'rpt-99',
    decision: 'allow',
    reason_code: 'policy_ok',
    policy_version: 'v2',
    trace_id: 'trace-abc',
    request_id: 'req-xyz',
    source_ip: '10.0.0.1',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('emitSoc2Event', () => {
  it('adds envelope fields, event_hash, and genesis previous_event_hash (first event)', () => {
    const result = emitSoc2Event({
      schemaName: 'audit_event',
      record: validAuditEvent(),
      now: FIXED_NOW,
      outbox: new Soc2EventOutbox(),
    });

    // Envelope fields present
    expect(result.record.ingested_at_utc).toBe('2026-07-04T12:00:00.000Z');
    expect(result.record.producer).toBe('xopure-crm');
    expect(result.record.environment).toBe('development');

    // Hash fields
    expect(result.record.event_hash).toBeTypeOf('string');
    expect(result.record.event_hash).toHaveLength(64); // SHA-256 hex
    expect(result.record.previous_event_hash).toBe('genesis');

    // Validation passed
    expect(result.validation.success).toBe(true);
    expect(result.record.schema_valid).toBe(true);
  });

  it('redacts sensitive values before hashing and outbox storage', () => {
    const record = {
      ...validAuditEvent(),
      api_key: 'sk-live-abc123',
      access_token: 'gho_secret_xyz',
      authorizationHeader: 'Bearer secret-token',
      nestedCredentials: {
        refreshToken: 'refresh-secret',
        publicKey: 'ssh-rsa secret',
      },
    };

    const result = emitSoc2Event({
      schemaName: 'audit_event',
      record,
      now: FIXED_NOW,
      outbox: new Soc2EventOutbox(),
    });

    // Redacted in output
    expect(result.record.api_key).toBe(REDACTED_MARKER);
    expect(result.record.access_token).toBe(REDACTED_MARKER);
    expect(result.record.authorizationHeader).toBe(REDACTED_MARKER);
    expect(result.record.nestedCredentials).toMatchObject({
      refreshToken: REDACTED_MARKER,
      publicKey: REDACTED_MARKER,
    });

    // Deterministic hash — same inputs (including now) produce same hash
    const result2 = emitSoc2Event({
      schemaName: 'audit_event',
      record,
      now: FIXED_NOW,
      outbox: new Soc2EventOutbox(),
    });

    expect(result2.record.event_hash).toBe(result.record.event_hash);
  });

  it('quarantines a validation failure with schema_valid=false and errors', () => {
    const record = {
      ...validAuditEvent(),
    };
    delete record.actor_id;

    const result = emitSoc2Event({
      schemaName: 'audit_event',
      record,
      now: FIXED_NOW,
      outbox: new Soc2EventOutbox(),
    });

    expect(result.validation.success).toBe(false);
    expect(result.record.schema_valid).toBe(false);
    expect(Array.isArray(result.record.validation_errors)).toBe(true);
    expect(result.record.validation_errors).not.toHaveLength(0);
    expect(result.record.quarantine_reason).toBeTypeOf('string');
  });

  it('chains second event previous_event_hash to first event_hash', () => {
    const outbox = new Soc2EventOutbox();
    const common = { ...validAuditEvent() };

    // First event
    const first = emitSoc2Event({
      schemaName: 'audit_event',
      record: { ...common, event_id: 'evt-001' },
      now: FIXED_NOW,
      outbox,
    });

    // Second event (different event_id to avoid collision — but same now
    // so the `ingested_at_utc` field collides; that's fine, they differ in
    // event_id and their hashes won't collide)
    const second = emitSoc2Event({
      schemaName: 'audit_event',
      record: { ...common, event_id: 'evt-002' },
      now: FIXED_NOW,
      outbox,
    });

    expect(first.record.previous_event_hash).toBe('genesis');
    expect(second.record.previous_event_hash).toBe(first.record.event_hash);
    expect(first.record.event_hash).not.toBe(second.record.event_hash);

    // Outbox contains exactly 2 records in order
    const all = outbox.list();
    expect(all).toHaveLength(2);
    expect(all[0].event_hash).toBe(first.record.event_hash);
    expect(all[1].event_hash).toBe(second.record.event_hash);
  });
});
