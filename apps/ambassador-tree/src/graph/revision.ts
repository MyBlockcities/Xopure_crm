/*
 * Stable, dependency-free SHA-256 input canonicalization.
 *
 * The actual digest is produced with Web Crypto so this module works in Node,
 * browsers, and test runners. Object keys are sorted recursively and arrays
 * retain their explicit order.
 */

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);

  return `{${entries.join(',')}}`;
};

export const canonicalJson = (value: unknown): string => canonicalize(value);

export const sha256 = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

