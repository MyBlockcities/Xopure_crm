import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CompApiClient } from './comp-api-client';
import { emitSoc2Event } from './soc2-event-emitter';
import { Soc2EventOutbox } from './soc2-event-outbox';
import { createOutboxFlusher } from './soc2-outbox-flusher';
import type { SupabaseAuditReader } from './supabase-audit-reader';

const auditRecord = (index: number): Record<string, unknown> => ({
  retention_class: 'standard',
  redaction_class: 'internal',
  schema_version: '2026-07-04',
  event_id: `event-${index}`,
  event_type: 'audit_event',
  occurred_at_utc: '2026-07-04T12:00:00.000Z',
  actor_id: `actor-${index}`,
  actor_role: 'agent',
  action: 'sync.write',
  resource_type: 'xopureCustomer',
  resource_id: `resource-${index}`,
  decision: 'allow',
  reason_code: 'policy_allow',
  policy_version: 'soc2-mvp',
  trace_id: `trace-${index}`,
  request_id: `request-${index}`,
  source_ip: '127.0.0.1',
});

const compClient = (
  submitEvidenceForm: CompApiClient['submitEvidenceForm'],
): CompApiClient => ({
  submitEvidenceForm,
}) as CompApiClient;

describe('createOutboxFlusher', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('submits each outbox event as Comp evidence and clears successful records', async () => {
    const outbox = new Soc2EventOutbox();
    for (const index of [1, 2, 3]) {
      emitSoc2Event({
        schemaName: 'audit_event',
        record: auditRecord(index),
        outbox,
      });
    }

    const submitEvidenceForm = vi.fn(async () => ({
      ok: true,
      submissionId: 'submission-1',
    }));
    const flusher = createOutboxFlusher(
      outbox,
      compClient(submitEvidenceForm),
      { batchSize: 2, formType: 'board-meeting' },
    );

    const result = await flusher.flushNow();

    expect(result).toEqual({ submitted: 3, failed: 0, errors: [] });
    expect(outbox.list()).toHaveLength(0);
    expect(submitEvidenceForm).toHaveBeenCalledTimes(3);
    expect(submitEvidenceForm).toHaveBeenNthCalledWith(
      1,
      'board-meeting',
      expect.objectContaining({
        schema_name: 'audit_event',
        event_type: 'audit_event',
        schema_valid: true,
        validation_errors: [],
        event_id: 'event-1',
        event_hash: expect.any(String),
      }),
    );
  });

  it('retries transient Comp 5xx failures before succeeding', async () => {
    vi.useFakeTimers();

    const outbox = new Soc2EventOutbox();
    emitSoc2Event({
      schemaName: 'audit_event',
      record: auditRecord(1),
      outbox,
    });

    const submitEvidenceForm = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: 'Comp 5xx' })
      .mockResolvedValueOnce({ ok: false, error: 'Comp 5xx' })
      .mockResolvedValueOnce({ ok: true, submissionId: 'submission-1' });
    const flusher = createOutboxFlusher(outbox, compClient(submitEvidenceForm));

    const flush = flusher.flushNow();
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await flush;

    expect(result).toEqual({ submitted: 1, failed: 0, errors: [] });
    expect(submitEvidenceForm).toHaveBeenCalledTimes(3);
    expect(outbox.list()).toHaveLength(0);
  });

  it('keeps failed records in the outbox for the next flush cycle', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const outbox = new Soc2EventOutbox();
    emitSoc2Event({
      schemaName: 'audit_event',
      record: auditRecord(1),
      outbox,
    });
    emitSoc2Event({
      schemaName: 'audit_event',
      record: auditRecord(2),
      outbox,
    });

    const submitEvidenceForm = vi.fn()
      .mockResolvedValueOnce({ ok: true, submissionId: 'submission-1' })
      .mockResolvedValue({ ok: false, error: 'Comp auth failed' });
    const flusher = createOutboxFlusher(outbox, compClient(submitEvidenceForm));

    const result = await flusher.flushNow();

    expect(result).toEqual({
      submitted: 1,
      failed: 1,
      errors: ['Comp auth failed'],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'CRITICAL: Comp API authentication failed; SOC2 evidence flush paused.',
    );
    expect(outbox.list()).toEqual([
      expect.objectContaining({ event_id: 'event-2' }),
    ]);
  });

  it('submits Supabase audit rows alongside outbox records', async () => {
    const outbox = new Soc2EventOutbox();
    const auditReader = {
      fetchUnsyncedRows: vi.fn(async () => [
        {
          audit_source: 'twenty_sync_audit',
          id: 'sync-1',
          created_at: '2026-07-04T12:00:00.000Z',
          status: 'success',
          payload_hash: '',
        },
      ]),
    } as unknown as SupabaseAuditReader;
    const submitEvidenceForm = vi.fn(async () => ({
      ok: true,
      submissionId: 'submission-1',
    }));
    const flusher = createOutboxFlusher(
      outbox,
      compClient(submitEvidenceForm),
      {
        auditReader,
        auditSince: new Date('2026-07-04T00:00:00.000Z'),
      },
    );

    const result = await flusher.flushNow();

    expect(result).toEqual({ submitted: 1, failed: 0, errors: [] });
    expect(auditReader.fetchUnsyncedRows).toHaveBeenCalledWith(
      new Date('2026-07-04T00:00:00.000Z'),
      25,
    );
    expect(submitEvidenceForm).toHaveBeenCalledWith(
      'board-meeting',
      expect.objectContaining({
        schema_name: 'audit_event',
        event_type: 'supabase_audit_row',
        evidence_source: 'supabase',
        audit_source: 'twenty_sync_audit',
        id: 'sync-1',
      }),
    );
  });

  it('submits invalid schema records with their quarantine reason for review', async () => {
    const outbox = new Soc2EventOutbox();
    const invalidRecord = auditRecord(1);
    delete invalidRecord.source_ip;
    emitSoc2Event({
      schemaName: 'audit_event',
      record: invalidRecord,
      outbox,
    });

    const submitEvidenceForm = vi.fn(async () => ({
      ok: true,
      submissionId: 'submission-1',
    }));
    const flusher = createOutboxFlusher(
      outbox,
      compClient(submitEvidenceForm),
    );

    await flusher.flushNow();

    expect(submitEvidenceForm).toHaveBeenCalledWith(
      'board-meeting',
      expect.objectContaining({
        schema_valid: false,
        validation_errors: expect.arrayContaining([
          'source_ip is required',
        ]),
        quarantine_reason: expect.stringContaining('source_ip'),
      }),
    );
  });
});
