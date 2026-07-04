import { describe, expect, it } from 'vitest';

import { validateSoc2Record } from './soc2-schema-validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEvidenceFields(): Record<string, unknown> {
  return {
    ingested_at_utc: '2026-07-03T12:00:01Z',
    producer: 'xopure-crm',
    environment: 'test',
    event_hash: 'sha256:audit-event-hash',
    previous_event_hash: 'sha256:previous-event-hash',
    retention_class: 'standard',
    redaction_class: 'internal',
    schema_valid: true,
  };
}

function validAuditEvent(): Record<string, unknown> {
  return {
    ...validEvidenceFields(),
    schema_version: '1.0',
    event_id: 'aevt-001',
    event_type: 'auth.rbac.allowed',
    actor_id: 'user-abc-123',
    actor_role: 'ambassador_rep',
    action: 'read',
    resource_type: 'commission',
    resource_id: 'comm-456',
    decision: 'allow',
    reason_code: 'POLICY_MATCH',
    policy_version: 'v2026.1',
    trace_id: 'trace-xyz-789',
    request_id: 'req-00001',
    source_ip: '100.64.0.10',
    tailnet_node: 'crm-gateway',
    tailnet_user: 'reviews-bot@xopure.tailnet',
    tailnet_tags: ['tag:xopure-dev-crm', 'tag:observability'],
    occurred_at_utc: '2026-07-03T12:00:00Z',
  };
}

function validRbacDecision(): Record<string, unknown> {
  return {
    ...validEvidenceFields(),
    event_hash: 'sha256:rbac-decision-hash',
    schema_version: '1.0',
    actor_id: 'user-abc-123',
    actor_role: 'ambassador_rep',
    tailscale_identity: 'reviews-bot@xopure.tailnet',
    jwt_jti: 'jti-a1b2c3',
    jit_grant_id: 'jit-01',
    action: 'read:commission',
    resource: 'comm-456',
    decision: 'allow',
    reason_code: 'POLICY_MATCH',
    policy_version: 'v2026.1',
    expires_at: '2026-07-03T12:30:00Z',
    evaluated_at_utc: '2026-07-03T12:00:05Z',
  };
}

function validLedgerEntry(): Record<string, unknown> {
  return {
    ...validEvidenceFields(),
    event_hash: 'sha256:ledger-entry-hash',
    schema_version: '1.0',
    ledger_id: 'led-1001',
    status: 'settled',
    pay_area: 'CUSTOMER_SALES',
    amount_cents: 25000,
    basis_cents: 500000,
    rate_bps: 500,
    recipient_id: 'user-def-456',
    buyer_id: 'user-ghi-789',
    classification: 'commission',
    order_id: 'ord-999',
    recorded_at: '2026-07-03T12:00:10Z',
  };
}

function validClaimReview(): Record<string, unknown> {
  return {
    ...validEvidenceFields(),
    event_hash: 'sha256:claim-review-hash',
    schema_version: '1.0',
    claim_id: 'clm-001',
    claim_text: 'Supports joint health with glucosamine',
    claim_channel: 'instagram',
    claim_author_type: 'ambassador',
    claim_category: 'wellness',
    prohibited_terms_detected: false,
    requires_disclosure: true,
    disclosure_present: true,
    substantiation_required: true,
    substantiation_asset_id: 'asset-789',
    review_status: 'approved',
    reviewer_id: 'user-admin-001',
    reviewed_at_utc: '2026-07-03T13:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateSoc2Record — audit_event', () => {
  it('accepts a valid audit_event with all required fields', () => {
    const result = validateSoc2Record('audit_event', validAuditEvent());

    expect(result.success).toBe(true);
  });

  it('rejects audit_event when the split source_ip field is missing', () => {
    const input = validAuditEvent();
    delete input.source_ip;
    input.source_ip_or_tailnet_node = '100.x.y.z';

    const result = validateSoc2Record('audit_event', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(messages.some((m: string) => m.includes('source_ip'))).toBe(true);
  });

  it('rejects audit_event when tailnet_tags is not a string array', () => {
    const input = validAuditEvent();
    input.tailnet_tags = 'tag:xopure-dev-crm';

    const result = validateSoc2Record('audit_event', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(messages.some((m: string) => m.includes('tailnet_tags'))).toBe(
      true,
    );
  });

  it('rejects audit_event when evidence-chain fields are missing', () => {
    const input = validAuditEvent();
    delete input.event_hash;

    const result = validateSoc2Record('audit_event', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(messages.some((m: string) => m.includes('event_hash'))).toBe(true);
  });

  it('rejects audit_event when schema_version is missing', () => {
    const input = validAuditEvent();
    delete input.schema_version;

    const result = validateSoc2Record('audit_event', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(messages.some((m: string) => m.includes('schema_version'))).toBe(
      true,
    );
  });

  it('requires quarantine details when schema_valid is false', () => {
    const input = validAuditEvent();
    input.schema_valid = false;

    const result = validateSoc2Record('audit_event', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(messages.some((m: string) => m.includes('validation_errors'))).toBe(
      true,
    );
    expect(messages.some((m: string) => m.includes('quarantine_reason'))).toBe(
      true,
    );
  });

  it('accepts quarantined audit_event when validation lifecycle details are present', () => {
    const input = validAuditEvent();
    input.schema_valid = false;
    input.validation_errors = ['resource_id is required'];
    input.quarantine_reason = 'schema_validation_failed';

    const result = validateSoc2Record('audit_event', input);

    expect(result.success).toBe(true);
  });
});

describe('validateSoc2Record — rbac_decision', () => {
  it('accepts a valid rbac_decision with all required fields', () => {
    const result = validateSoc2Record('rbac_decision', validRbacDecision());

    expect(result.success).toBe(true);
  });

  it('rejects rbac_decision with an invalid decision value', () => {
    const input = validRbacDecision();
    input.decision = 'maybe';

    const result = validateSoc2Record('rbac_decision', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(messages.some((m: string) => m.includes('decision'))).toBe(true);
  });
});

describe('validateSoc2Record — ledger_entry', () => {
  it('accepts a valid ledger_entry with integer cents and distinct parties', () => {
    const result = validateSoc2Record('ledger_entry', validLedgerEntry());

    expect(result.success).toBe(true);
  });

  it('rejects ledger_entry where recipient equals buyer', () => {
    const input = validLedgerEntry();
    input.recipient_id = input.buyer_id;

    const result = validateSoc2Record('ledger_entry', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(
      messages.some(
        (m: string) => m.includes('recipient') || m.includes('buyer'),
      ),
    ).toBe(true);
  });

  it('rejects ledger_entry where amount_cents is not an integer', () => {
    const input = validLedgerEntry();
    input.amount_cents = 12.5;

    const result = validateSoc2Record('ledger_entry', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(messages.some((m: string) => m.includes('cent'))).toBe(true);
  });
});

describe('validateSoc2Record — claim_review', () => {
  it('accepts a valid claim_review with disclosure present when required', () => {
    const result = validateSoc2Record('claim_review', validClaimReview());

    expect(result.success).toBe(true);
  });

  it('rejects claim_review when requires_disclosure is true but disclosure_present is false', () => {
    const input = validClaimReview();
    input.requires_disclosure = true;
    input.disclosure_present = false;

    const result = validateSoc2Record('claim_review', input);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    const messages = result.errors!.map((e: string) => e.toLowerCase());
    expect(
      messages.some(
        (m: string) => m.includes('disclos') && m.includes('required'),
      ),
    ).toBe(true);
  });
});
