import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tempoTraceHandler } from 'src/logic-functions/handlers/tempo-trace-handler';

beforeEach(() => {
  delete process.env.GRAFANA_URL;
  delete process.env.GRAFANA_API_KEY;
  delete process.env.TEMPO_DATASOURCE_UID;
  vi.unstubAllGlobals();
});

afterEach(() => {
  delete process.env.GRAFANA_URL;
  delete process.env.GRAFANA_API_KEY;
  delete process.env.TEMPO_DATASOURCE_UID;
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

describe('tempoTraceHandler', () => {
  it('returns a sanitized error when GRAFANA_URL is missing', async () => {
    process.env.GRAFANA_API_KEY = 'key';
    process.env.TEMPO_DATASOURCE_UID = 'uid';
    const fetchMock = stubFetch();

    const result = await tempoTraceHandler({ traceId: 'abc123' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/grafana_url/i),
    });
    expect(JSON.stringify(result)).not.toContain('key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a sanitized error when GRAFANA_API_KEY is missing', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.TEMPO_DATASOURCE_UID = 'uid';
    const fetchMock = stubFetch();

    const result = await tempoTraceHandler({ traceId: 'abc123' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/api_key/i),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a sanitized error when TEMPO_DATASOURCE_UID is missing', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 'key';
    const fetchMock = stubFetch();

    const result = await tempoTraceHandler({ traceId: 'abc123' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/tempo/i),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a sanitized error for a blank trace ID', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 'key';
    process.env.TEMPO_DATASOURCE_UID = 'uid';
    const fetchMock = stubFetch();

    const result = await tempoTraceHandler({ traceId: '   ' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/trace/i),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes a fetch call to the Tempo trace proxy URL with Authorization header', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 's3cret-key';
    process.env.TEMPO_DATASOURCE_UID = 'uid-xyz';
    const mockData = {
      traceID: 'abc123',
      rootServiceName: 'xopure-crm',
      spans: [],
    };
    const fetchMock = stubFetch(mockData);

    const result = await tempoTraceHandler({ traceId: 'abc123' });

    expect(result).toEqual({ success: true, trace: mockData });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      'https://grafana.xopure.com/api/datasources/proxy/uid/uid-xyz/tempo/api/traces/abc123',
    );
    expect(init.headers).toEqual({ Authorization: 'Bearer s3cret-key' });
  });

  it('returns a sanitized error shape on fetch failure without echoing the API key or trace ID', async () => {
    process.env.GRAFANA_URL = 'https://grafana.xopure.com';
    process.env.GRAFANA_API_KEY = 's3cret-key';
    process.env.TEMPO_DATASOURCE_UID = 'uid-xyz';
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => 'Trace not found',
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const result = await tempoTraceHandler({ traceId: 'abc123' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Must not leak the API key in error messages
    expect(JSON.stringify(result)).not.toContain('s3cret-key');
    // Must not echo the request body back
    expect(JSON.stringify(result)).not.toContain('abc123');
  });
});
