// ---------------------------------------------------------------------------
// SOC2 deterministic redactor for sensitive fields
// ---------------------------------------------------------------------------
// Replaces values on keys matching known sensitive patterns with a stable
// marker. Preserves structure everywhere else. Bounded recursion depth.
// ---------------------------------------------------------------------------

const REDACTED_MARKER = '[REDACTED]';
/**
 * Key segments that mark a field as sensitive (case-insensitive, checked
 * after splitting on _ - . boundaries).
 */
const SENSITIVE_SEGMENTS: Record<string, true> = {
  token: true,
  secret: true,
  password: true,
  authorization: true,
  cookie: true,
  key: true,
  apikey: true,
  accesskey: true,
  privatekey: true,
};

const MAX_DEPTH = 10;
/** Returns true when a key contains a sensitive segment. */
function isSensitiveKey(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  // Compound keys like "access_token", "client_secret", "api_key", or
  // camelCase forms like "authorizationHeader" and "refreshToken".
  if (normalized.includes('_') || normalized.includes('-') || normalized.includes('.')) {
    const segments = normalized.split(/[_\-.]/).filter(Boolean);
    for (let i = 0; i < segments.length; i++) {
      if (SENSITIVE_SEGMENTS[segments[i]]) return true;
    }
  }
  return !!SENSITIVE_SEGMENTS[normalized];
}

/**
 * Recursively redact sensitive key values from an arbitrary value.
 *
 * - Strings, numbers, booleans, null — returned as-is unless the parent key
 *   is sensitive, in which case [REDACTED] is substituted.
 * - Objects — recursed with depth tracking. Sensitive keys replaced with marker.
 * - Arrays — each element recursed individually.
 * - Depth exceeding MAX_DEPTH returns `null` for the subtree.
 */
export function redactRecord(
  value: unknown,
  depth: number = 0,
): unknown {
  if (depth > MAX_DEPTH) {
    return null;
  }

  // Scalars (non-object, non-array) — pass through as-is when reached by
  // non-sensitive path. The parent caller handles key-level redaction.
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactRecord(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const isSensitive = isSensitiveKey(key);
      result[key] = isSensitive
        ? REDACTED_MARKER
        : redactRecord(val, depth + 1);
    }
    return result;
  }

  return value;
}

/** The stable marker used for redacted values. */
export { REDACTED_MARKER };
