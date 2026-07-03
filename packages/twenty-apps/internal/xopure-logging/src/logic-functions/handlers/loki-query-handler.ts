import { buildLokiProxyUrl, buildProxyHeaders } from 'src/utils/grafana-url';

export async function lokiQueryHandler(args: {
  query: string;
  limit?: number;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const grafanaUrl = process.env.GRAFANA_URL;
  const apiKey = process.env.GRAFANA_API_KEY;
  const lokiUid = process.env.LOKI_DATASOURCE_UID;

  if (!grafanaUrl) {
    return { success: false, error: 'Missing grafana_url configuration' };
  }

  if (!apiKey) {
    return { success: false, error: 'Missing api_key configuration' };
  }

  if (!lokiUid) {
    return { success: false, error: 'Missing loki datasource UID configuration' };
  }

  if (!args.query || !args.query.trim()) {
    return { success: false, error: 'Empty query parameter' };
  }

  try {
    const url = buildLokiProxyUrl(grafanaUrl, lokiUid, args.query, args.limit);
    const headers = buildProxyHeaders(apiKey);
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return { success: false, error: `Request failed with status ${response.status}` };
    }

    const body = (await response.json()) as Record<string, unknown>;
    return { success: true, data: (body.data as unknown) ?? body };
  } catch {
    return { success: false, error: 'Failed to query Loki' };
  }
}
