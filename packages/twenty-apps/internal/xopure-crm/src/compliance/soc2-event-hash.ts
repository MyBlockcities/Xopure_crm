// ---------------------------------------------------------------------------
// SOC2 deterministic event hashing (SHA-256)
// ---------------------------------------------------------------------------
// Produces a stable, self-reference-free hex digest from a record by
// canonicalizing keys and stripping hash fields that would cause circularity.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';

/** Fields to exclude before hashing (emitter-owned hash fields). */
const HASH_EXCLUDED_FIELDS = new Set(['event_hash', 'previous_event_hash']);

/**
 * Deterministic JSON serialisation: sorted keys, no whitespace.
 * Strips `event_hash` and `previous_event_hash` to avoid self-reference.
 */
export function canonicalStringify(record: Record<string, unknown>): string {
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (!HASH_EXCLUDED_FIELDS.has(key)) {
      cleaned[key] = record[key];
    }
  }
  return JSON.stringify(cleaned, deterministicReplacer);
}

/**
 * Compute a hex SHA-256 digest for an event record.
 *
 * Hash fields (event_hash, previous_event_hash) are excluded so that the
 * digest is self-reference-free.
 */
export function computeEventHash(record: Record<string, unknown>): string {
  const canonical = canonicalStringify(record);
  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

// ---------------------------------------------------------------------------
// Replacer that produces consistent sort order for all nesting levels
// ---------------------------------------------------------------------------
// JSON.stringify's native "stable replacer" only preserves the order of the
// replacer array; nested objects need explicit handling.
function deterministicReplacer(this: unknown, _key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(record).sort()) {
      sorted[k] = record[k];
    }
    return sorted;
  }
  return value;
}
