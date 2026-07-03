import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lokiQueryHandler } from 'src/logic-functions/handlers/loki-query-handler';

beforeEach(() => {
  delete process.env.GRAFANA_URL;
  delete process.env.GRAFANA_API_KEY;
  delete process.env.LOKI_DATASOURCE_UID;
  vi.unstubAllGlobals();
});

afterEach(() => {
  delete process.env.GRAFANA_URL;
  delete process.env.GRAFANA_API_KEY;
  delete process.env.LOKI_DATASOURCE_UID;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stubFetch = (mockResponse: Record<string, unknown> = {}) => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => mockResponse,
    text: async () => '',
  })) as unknown as typeof fetch & { mock: { calls: unknown[][] } };

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('lokiQueryHandler', () => {
  it('returns a sanitized error when GRAFANA_URL is missing', async () => {
    process.env.GRAFANA_API_KEY = 'key';
    process.env.LOKI_DATASOURCE_UID = 'uid';
    const fetchMock = stubFetch();

    const result = await lokiQueryHandler({ query: '{service="xopure"}' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/grafana_url/i),
    });
    // Sanitized: must not echo process environment values
    expect(JSON.stringify(result)).not.toContain('key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a sanitized error when GRAFANA_API_KEY is missing', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.LOKI_DATASOURCE_UID = 'uid';
    const fetchMock = stubFetch();

    const result = await lokiQueryHandler({ query: '{service="xopure"}' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/api_key/i),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a sanitized error when LOKI_DATASOURCE_UID is missing', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 'key';
    const fetchMock = stubFetch();

    const result = await lokiQueryHandler({ query: '{service="xopure"}' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/loki/i),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a sanitized error for a blank query', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 'key';
    process.env.LOKI_DATASOURCE_UID = 'uid';
    const fetchMock = stubFetch();

    const result = await lokiQueryHandler({ query: '   ' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/query/i),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes a fetch call to the Loki proxy URL with Authorization header', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 's3cret-key';
    process.env.LOKI_DATASOURCE_UID = 'uid-abc';
    const fetchMock = stubFetch({ data: { result: [] } });

    const result = await lokiQueryHandler({ query: '{app="xopure"}' });

    expect(result).toEqual({
      success: true,
      data: { result: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/datasources/proxy/uid/uid-abc/loki/api/v1/query_range');
    expect(url).toContain('query=%7Bapp%3D%22xopure%22%7D');
    expect(url).toContain('limit=1000');
    expect(init.headers).toEqual({ Authorization: 'Bearer s3cret-key' });
  });

  it('clamps limit to 5000 when the caller requests more', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 'key';
    process.env.LOKI_DATASOURCE_UID = 'uid-abc';
    const fetchMock = stubFetch({ data: { result: [] } });

    await lokiQueryHandler({ query: '{app="xopure"}', limit: 9999 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('limit=5000');
  });

  it('returns a sanitized error shape on fetch failure without echoing the API key', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 's3cret-key';
    process.env.LOKI_DATASOURCE_UID = 'uid-abc';
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway',
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const result = await lokiQueryHandler({ query: '{app="xopure"}' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Must not leak the API key in error messages
    expect(JSON.stringify(result)).not.toContain('s3cret-key');
    // Must not echo the request body back to the caller
    expect(JSON.stringify(result)).not.toContain('{app=');
  });
});
