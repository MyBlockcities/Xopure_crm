// ---------------------------------------------------------------------------
// SOC2 outbox flusher — submit CRM compliance evidence to Comp AI
// ---------------------------------------------------------------------------

import { setTimeout as delay } from 'node:timers/promises';

import type { CompApiClient, EvidenceFormType } from './comp-api-client';
import type { Soc2EmittedRecord, Soc2EventOutbox } from './soc2-event-outbox';
import type { SupabaseAuditReader, SupabaseAuditRow } from './supabase-audit-reader';

export interface FlushConfig {
  batchSize: number;
  flushIntervalMs: number;
  formType: EvidenceFormType;
  auditReader?: SupabaseAuditReader;
  auditSince?: Date;
}

export interface FlushResult {
  submitted: number;
  failed: number;
  errors: string[];
}

export interface OutboxFlusher {
  start(): void;
  stop(): void;
  flushNow(): Promise<FlushResult>;
}

const DEFAULT_CONFIG: FlushConfig = {
  batchSize: 25,
  flushIntervalMs: 60_000,
  formType: 'board-meeting',
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;
const OUTBOX_WARN_THRESHOLD = 1_000;

const isAuthFailure = (error: string | undefined): boolean =>
  error === 'Comp auth failed';

const toEvidencePayload = (record: Soc2EmittedRecord): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    ...record,
    schema_name: record.schema_name ?? record.event_type ?? 'soc2_event',
    event_type: record.event_type ?? record.schema_name ?? 'soc2_event',
    schema_valid: record.schema_valid ?? true,
    validation_errors: record.validation_errors ?? [],
  };

  return payload;
};

const toSupabaseAuditPayload = (
  row: SupabaseAuditRow,
): Record<string, unknown> => ({
  schema_name: 'audit_event',
  event_type: 'supabase_audit_row',
  schema_valid: true,
  validation_errors: [],
  evidence_source: 'supabase',
  ...row,
});

const chunkRecords = <T>(records: readonly T[], batchSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += batchSize) {
    chunks.push(records.slice(index, index + batchSize));
  }

  return chunks;
};

export function createOutboxFlusher(
  outbox: Soc2EventOutbox,
  client: CompApiClient,
  config: Partial<FlushConfig> = {},
): OutboxFlusher {
  const effectiveConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };
  let interval: NodeJS.Timeout | undefined;
  let inFlightFlush: Promise<FlushResult> | undefined;
  let auditSince = effectiveConfig.auditSince ?? new Date(0);

  const submitWithRetry = async (payload: Record<string, unknown>) => {
    let lastError = 'Comp API request failed';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const result = await client.submitEvidenceForm(
        effectiveConfig.formType,
        payload,
      );

      if (result.ok) {
        return { ok: true as const };
      }

      lastError = result.error ?? lastError;
      if (isAuthFailure(result.error) || attempt === MAX_ATTEMPTS) {
        if (isAuthFailure(result.error)) {
          console.warn('CRITICAL: Comp API authentication failed; SOC2 evidence flush paused.');
        }
        return { ok: false as const, error: lastError };
      }

      await delay(RETRY_DELAY_MS);
    }

    return { ok: false as const, error: lastError };
  };

  const flushNow = async (): Promise<FlushResult> => {
    if (inFlightFlush) {
      return inFlightFlush;
    }

    inFlightFlush = (async () => {
      const records = outbox.list();
      if (records.length > OUTBOX_WARN_THRESHOLD) {
        console.warn(
          `SOC2 event outbox contains ${records.length} records; Comp AI may be offline.`,
        );
      }

      const errors: string[] = [];
      const failedRecords: Soc2EmittedRecord[] = [];
      let submitted = 0;

      for (const batch of chunkRecords(records, effectiveConfig.batchSize)) {
        for (const record of batch) {
          const result = await submitWithRetry(toEvidencePayload(record));
          if (result.ok) {
            submitted += 1;
          } else {
            failedRecords.push(record);
            errors.push(result.error);
          }
        }
      }

      if (submitted > 0) {
        outbox.clear();
        for (const record of failedRecords) {
          outbox.enqueue(record);
        }
      }

      if (effectiveConfig.auditReader) {
        const auditRows = await effectiveConfig.auditReader.fetchUnsyncedRows(
          auditSince,
          effectiveConfig.batchSize,
        );
        let submittedAuditRows = 0;

        for (const row of auditRows) {
          const result = await submitWithRetry(toSupabaseAuditPayload(row));
          if (result.ok) {
            submitted += 1;
            submittedAuditRows += 1;
          } else {
            errors.push(result.error);
          }
        }

        if (auditRows.length > 0 && submittedAuditRows === auditRows.length) {
          const latestCreatedAt = auditRows[auditRows.length - 1]?.created_at;
          if (latestCreatedAt) {
            auditSince = new Date(latestCreatedAt);
          }
        }
      }

      return {
        submitted,
        failed: errors.length,
        errors,
      };
    })();

    try {
      return await inFlightFlush;
    } finally {
      inFlightFlush = undefined;
    }
  };

  return {
    start(): void {
      if (interval) {
        return;
      }

      interval = setInterval(() => {
        flushNow().catch((error: unknown) => {
          console.warn('SOC2 evidence flush failed unexpectedly.', error);
        });
      }, effectiveConfig.flushIntervalMs);
    },

    stop(): void {
      if (!interval) {
        return;
      }

      clearInterval(interval);
      interval = undefined;
    },

    flushNow,
  };
}
