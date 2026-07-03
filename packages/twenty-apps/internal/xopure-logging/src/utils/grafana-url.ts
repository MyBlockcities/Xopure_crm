export interface GrafanaIframeOptions {
  from?: string;
  to?: string;
}

/**
 * Build a safe Grafana iframe URL with record/user context variables.
 * Rejects javascript: URLs, credential-bearing URLs, and empty IDs.
 */
export function buildGrafanaIframeUrl(
  baseUrl: string,
  recordId: string,
  userId: string,
  opts?: GrafanaIframeOptions,
): string {
  if (!recordId) throw new Error('recordId must not be empty');
  if (!userId) throw new Error('userId must not be empty');

  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https protocols are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Base URL must not contain embedded credentials');
  }

  // Strip trailing slash by re-building origin + pathname without trailing slash
  const cleanHost = `${parsed.protocol}//${parsed.host}`;
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  const cleanBase = cleanPath ? `${cleanHost}${cleanPath}` : cleanHost;

  const parts: string[] = [
    `var-recordId=${encodeURIComponent(recordId)}`,
    `var-userId=${encodeURIComponent(userId)}`,
  ];
  if (opts?.from) parts.push(`from=${encodeURIComponent(opts.from)}`);
  if (opts?.to) parts.push(`to=${encodeURIComponent(opts.to)}`);

  return `${cleanBase}/d/br?${parts.join('&')}`;
}

/**
 * Build a Grafana Loki datasource proxy URL for query_range.
 * Default limit 1000, clamped to 5000 maximum.
 */
export function buildLokiProxyUrl(
  grafanaUrl: string,
  lokiUid: string,
  query: string,
  limit?: number,
): string {
  if (!query || !query.trim()) throw new Error('query must not be blank');
  if (limit !== undefined && limit < 0) throw new Error('limit must not be negative');
  if (!lokiUid) throw new Error('lokiUid must not be empty');

  const clamped = limit === undefined ? 1000 : Math.min(limit, 5000);
  const base = grafanaUrl.replace(/\/+$/, '');
  return `${base}/api/datasources/proxy/uid/${encodeURIComponent(lokiUid)}/loki/api/v1/query_range?query=${encodeURIComponent(query)}&limit=${clamped}`;
}

/**
 * Build a Grafana Tempo datasource proxy URL for trace retrieval.
 */
export function buildTempoTraceUrl(
  grafanaUrl: string,
  tempoUid: string,
  traceId: string,
): string {
  if (!traceId || !traceId.trim()) throw new Error('traceId must not be blank');
  if (!tempoUid) throw new Error('tempoUid must not be empty');

  const base = grafanaUrl.replace(/\/+$/, '');
  return `${base}/api/datasources/proxy/uid/${encodeURIComponent(tempoUid)}/tempo/api/traces/${encodeURIComponent(traceId)}`;
}

/**
 * Build Authorization header object for Grafana proxy requests.
 */
export function buildProxyHeaders(apiKey: string): Record<string, string> {
  if (!apiKey || !apiKey.trim()) throw new Error('apiKey must not be blank');
  return { Authorization: `Bearer ${apiKey}` };
}
