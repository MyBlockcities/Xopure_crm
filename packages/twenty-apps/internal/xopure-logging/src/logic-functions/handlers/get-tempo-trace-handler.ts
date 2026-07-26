import { type RoutePayload } from 'twenty-sdk/define';

type TempoInput = { traceId: string; start?: string; end?: string };
type TempoResult = { ok: boolean; status: number; trace: unknown; error?: string };

const isRoutePayload = (value: unknown): value is RoutePayload =>
  typeof value === 'object' && value !== null && 'requestContext' in value;

const readInput = (event: RoutePayload | TempoInput): TempoInput => {
  const input = isRoutePayload(event) ? event.body : event;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Input must be a JSON object.');
  }
  const { traceId, start, end } = input as Record<string, unknown>;
  if (typeof traceId !== 'string' || !/^[0-9a-fA-F]{16,32}$/.test(traceId)) {
    throw new Error('traceId must be a 16- or 32-character hexadecimal trace ID.');
  }
  if (start !== undefined && typeof start !== 'string') throw new Error('start must be a string.');
  if (end !== undefined && typeof end !== 'string') throw new Error('end must be a string.');
  return { traceId: traceId.toLowerCase(), start, end };
};

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing application variable: ${name}.`);
  return value;
};

const errorMessage = (body: unknown, fallback: string): string => {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return fallback;
};

export const handleTempoTrace = async (event: RoutePayload | TempoInput): Promise<TempoResult> => {
  try {
    const input = readInput(event);
    const baseUrl = requiredEnv('GRAFANA_URL').replace(/\/+$/, '');
    const apiKey = requiredEnv('GRAFANA_API_KEY');
    const datasourceUid = requiredEnv('TEMPO_DATASOURCE_UID');
    const url = new URL(`${baseUrl}/api/datasources/proxy/uid/${encodeURIComponent(datasourceUid)}/api/traces/${input.traceId}`);

    if (input.start) url.searchParams.set('start', input.start);
    if (input.end) url.searchParams.set('end', input.end);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, status: response.status, trace: null, error: errorMessage(body, response.statusText) };
    }

    return { ok: true, status: response.status, trace: body };
  } catch (error) {
    return { ok: false, status: 400, trace: null, error: error instanceof Error ? error.message : 'Tempo trace lookup failed.' };
  }
};
