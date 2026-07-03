import { buildProxyHeaders, buildTempoTraceUrl } from 'src/utils/grafana-url';

export async function tempoTraceHandler(args: {
  traceId: string;
}): Promise<{ success: boolean; trace?: unknown; error?: string }> {
  const grafanaUrl = process.env.GRAFANA_URL;
  const apiKey = process.env.GRAFANA_API_KEY;
  const tempoUid = process.env.TEMPO_DATASOURCE_UID;

  if (!grafanaUrl) {
    return { success: false, error: 'Missing grafana_url configuration' };
  }

  if (!apiKey) {
    return { success: false, error: 'Missing api_key configuration' };
  }

  if (!tempoUid) {
    return { success: false, error: 'Missing tempo datasource UID configuration' };
  }

  if (!args.traceId || !args.traceId.trim()) {
    return { success: false, error: 'Empty traceId parameter' };
  }

  try {
    const url = buildTempoTraceUrl(grafanaUrl, tempoUid, args.traceId);
    const headers = buildProxyHeaders(apiKey);
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return { success: false, error: `Request failed with status ${response.status}` };
    }

    const body = await response.json();
    return { success: true, trace: body };
  } catch {
    return { success: false, error: 'Failed to query Tempo' };
  }
}
