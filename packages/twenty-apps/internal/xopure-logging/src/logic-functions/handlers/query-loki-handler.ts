import { type RoutePayload } from 'twenty-sdk/define';

type LokiInput = {
  query: string;
  start?: string;
  end?: string;
  limit?: number;
};

type LokiResult = {
  ok: boolean;
  status: number;
  results: unknown[];
  resultType?: string;
  stats?: unknown;
  error?: string;
};

const isRoutePayload = (value: unknown): value is RoutePayload =>
  typeof value === 'object' && value !== null && 'requestContext' in value;

const readInput = (event: RoutePayload | LokiInput): LokiInput => {
  const input = isRoutePayload(event) ? event.body : event;

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Input must be a JSON object.');
  }

  const { query, start, end, limit } = input as Record<string, unknown>;

  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('query must be a non-empty string.');
  }
  if (start !== undefined && typeof start !== 'string') {
    throw new Error('start must be a string.');
  }
  if (end !== undefined && typeof end !== 'string') {
    throw new Error('end must be a string.');
  }
  if (limit !== undefined && (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 5000)) {
    throw new Error('limit must be an integer between 1 and 5000.');
  }

  return { query: query.trim(), start, end, limit: limit as number | undefined };
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

export const handleLokiQuery = async (event: RoutePayload | LokiInput): Promise<LokiResult> => {
  try {
    const input = readInput(event);
    const baseUrl = requiredEnv('GRAFANA_URL').replace(/\/+$/, '');
    const apiKey = requiredEnv('GRAFANA_API_KEY');
    const datasourceUid = requiredEnv('LOKI_DATASOURCE_UID');
    const now = Date.now();
    const url = new URL(`${baseUrl}/api/datasources/proxy/uid/${encodeURIComponent(datasourceUid)}/loki/api/v1/query_range`);

    url.searchParams.set('query', input.query);
    url.searchParams.set('start', input.start ?? new Date(now - 60 * 60 * 1000).toISOString());
    url.searchParams.set('end', input.end ?? new Date(now).toISOString());
    url.searchParams.set('limit', String(input.limit ?? 100));
    url.searchParams.set('direction', 'backward');

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, status: response.status, results: [], error: errorMessage(body, response.statusText) };
    }

    const data = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).data : undefined;
    const dataRecord = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};

    return {
      ok: true,
      status: response.status,
      results: Array.isArray(dataRecord.result) ? dataRecord.result : [],
      resultType: typeof dataRecord.resultType === 'string' ? dataRecord.resultType : undefined,
      stats: dataRecord.stats,
    };
  } catch (error) {
    return { ok: false, status: 400, results: [], error: error instanceof Error ? error.message : 'Loki query failed.' };
  }
};
