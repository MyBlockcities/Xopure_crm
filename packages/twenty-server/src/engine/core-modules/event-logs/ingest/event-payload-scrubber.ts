export const REDACTED = '[REDACTED]';
export const DEFAULT_MAX_DEPTH = 10;
const MAX_ARRAY_LENGTH = 25;
const MAX_STRING_LENGTH = 2048;

const SENSITIVE_KEY_NAMES = new Set([
  'apikey',
  'authorization',
  'cookie',
  'email',
  'password',
  'secret',
  'token',
]);

const normalizeKey = (key: string) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '');

const isSensitiveKey = (key: string) =>
  SENSITIVE_KEY_NAMES.has(normalizeKey(key));

const redactSensitiveString = (value: string) =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(
      /\b(api[_-]?key|token|secret|password)=([^&\s]+)/gi,
      `$1=${REDACTED}`,
    );

export const scrubPayload = (
  value: unknown,
  maxDepth = DEFAULT_MAX_DEPTH,
  depth = 0,
): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    const scrubbed = redactSensitiveString(value);

    return scrubbed.length > MAX_STRING_LENGTH
      ? `${scrubbed.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`
      : scrubbed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (maxDepth <= 0 || (depth >= maxDepth && depth > 0)) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    const scrubbedItems = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) =>
        scrubPayload(
          item,
          maxDepth,
          typeof item === 'object' && item !== null ? depth + 1 : depth,
        ),
      );

    return value.length > MAX_ARRAY_LENGTH
      ? [...scrubbedItems, '[TRUNCATED]']
      : scrubbedItems;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        isSensitiveKey(key)
          ? REDACTED
          : scrubPayload(item, maxDepth, depth + 1),
      ]),
    );
  }

  return String(value);
};

export const scrubEventPayload = scrubPayload;
