// ---------------------------------------------------------------------------
// SOC2 evidence bootstrap — optional runtime bridge into Comp AI
// ---------------------------------------------------------------------------

import { CompApiClient } from './comp-api-client';
import { getDefaultOutbox } from './soc2-event-outbox';
import { createOutboxFlusher, type OutboxFlusher } from './soc2-outbox-flusher';
import { SupabaseAuditReader } from './supabase-audit-reader';

let activeFlusher: OutboxFlusher | undefined;

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Start the CRM SOC2 evidence flusher.
 *
 * Import and call this from the server-side Twenty app initialization path.
 * It is intentionally inert unless that runtime calls it; tests and CLI tools
 * can import compliance producers without creating background intervals.
 */
export function startSoc2EvidenceFlusher(
  env: Record<string, string | undefined> = process.env,
): OutboxFlusher {
  if (activeFlusher) {
    return activeFlusher;
  }

  const auditReader = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseAuditReader(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : undefined;

  activeFlusher = createOutboxFlusher(
    getDefaultOutbox(),
    new CompApiClient(env.COMP_API_URL, env.COMP_API_KEY),
    {
      batchSize: parsePositiveInteger(env.SOC2_COMP_BATCH_SIZE, 25),
      flushIntervalMs: parsePositiveInteger(
        env.SOC2_COMP_FLUSH_INTERVAL_MS,
        60_000,
      ),
      formType: 'board-meeting',
      auditReader,
    },
  );
  activeFlusher.start();

  if (!env.COMP_API_KEY) {
    console.warn('COMP_API_KEY is unset; SOC2 evidence flusher started but Comp submissions will fail auth.');
  }

  if (!auditReader) {
    console.warn('Supabase audit reader disabled; SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unset.');
  }

  return activeFlusher;
}

export function stopSoc2EvidenceFlusher(): void {
  if (!activeFlusher) {
    return;
  }

  activeFlusher.stop();
  activeFlusher = undefined;
}
