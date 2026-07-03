import { describe, expect, it } from 'vitest';

import {
  buildGrafanaIframeUrl,
  buildLokiProxyUrl,
  buildProxyHeaders,
  buildTempoTraceUrl,
} from 'src/utils/grafana-url';

describe('buildGrafanaIframeUrl', () => {
  it('accepts an https Grafana base URL and appends record/user variables', () => {
    const url = buildGrafanaIframeUrl(
      'https://grafana.xopure.com',
      'rec-123',
      'usr-456',
    );
    expect(url).toMatch(/^https:\/\/grafana\.xopure\.com\//);
    expect(url).toContain('var-recordId=rec-123');
    expect(url).toContain('var-userId=usr-456');
  });

  it('strips a trailing slash from the base URL', () => {
    const url = buildGrafanaIframeUrl(
      'https://grafana.xopure.com/',
      'rec-1',
      'usr-2',
    );
    expect(url.startsWith('https://grafana.xopure.com/')).toBe(true);
    expect(url).not.toMatch(/https:\/\/[^/]+\/\//);
  });

  it('accepts an http Grafana base URL', () => {
    const url = buildGrafanaIframeUrl(
      'http://localhost:3000',
      'rec-1',
      'usr-2',
    );
    expect(url).toMatch(/^http:\/\/localhost:3000\//);
  });

  it('rejects a javascript: URL', () => {
    expect(() =>
      buildGrafanaIframeUrl('javascript:alert("xss")', 'rec-1', 'usr-2'),
    ).toThrow();
  });

  it('rejects a URL that embeds a credential-bearing pattern', () => {
    expect(() =>
      buildGrafanaIframeUrl('https://user:pass@grafana.xopure.com', 'rec-1', 'usr-2'),
    ).toThrow();
  });

  it('preserves a bounded `from` parameter when provided', () => {
    const url = buildGrafanaIframeUrl(
      'https://grafana.xopure.com',
      'rec-1',
      'usr-2',
      { from: 'now-7d' },
    );
    expect(url).toContain('from=now-7d');
  });

  it('preserves a bounded `to` parameter when provided', () => {
    const url = buildGrafanaIframeUrl(
      'https://grafana.xopure.com',
      'rec-1',
      'usr-2',
      { to: 'now' },
    );
    expect(url).toContain('to=now');
  });

  it('never includes GRAFANA_API_KEY in the returned URL', () => {
    const url = buildGrafanaIframeUrl(
      'https://grafana.xopure.com',
      'rec-1',
      'usr-2',
    );
    expect(url).not.toMatch(/[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]/);
    expect(url).not.toMatch(/[Aa]uthorization/i);
    expect(url).not.toMatch(/[Bb]earer/i);
    expect(url).not.toMatch(/[Tt]oken/i);
  });

  it('URL-encodes recordId and userId values', () => {
    const url = buildGrafanaIframeUrl(
      'https://grafana.xopure.com',
      'rec with spaces',
      'usr/foo',
    );
    expect(url).toContain('var-recordId=rec%20with%20spaces');
    expect(url).toContain('var-userId=usr%2Ffoo');
  });

  it('throws for an empty recordId', () => {
    expect(() =>
      buildGrafanaIframeUrl('https://grafana.xopure.com', '', 'usr-1'),
    ).toThrow();
  });

  it('throws for an empty userId', () => {
    expect(() =>
      buildGrafanaIframeUrl('https://grafana.xopure.com', 'rec-1', ''),
    ).toThrow();
  });
});

describe('buildLokiProxyUrl', () => {
  const GRAFANA = 'https://grafana.xopure.com';
  const LOKI_UID = 'abc123';

  it('uses /api/datasources/proxy/uid/<uid>/loki/api/v1/query_range', () => {
    const url = buildLokiProxyUrl(GRAFANA, LOKI_UID, '{service="xopure"}');
    expect(url).toContain(
      `/api/datasources/proxy/uid/${LOKI_UID}/loki/api/v1/query_range`,
    );
  });

  it('includes the query parameter', () => {
    const url = buildLokiProxyUrl(GRAFANA, LOKI_UID, '{service="xopure"}');
    expect(url).toContain('query=%7Bservice%3D%22xopure%22%7D');
  });

  it('defaults limit to 1000 when not provided', () => {
    const url = buildLokiProxyUrl(GRAFANA, LOKI_UID, '{service="all"}');
    expect(url).toContain('limit=1000');
  });

  it('clamps limit to 5000 maximum', () => {
    const url = buildLokiProxyUrl(GRAFANA, LOKI_UID, '{service="all"}', 9999);
    expect(url).toContain('limit=5000');
  });

  it('allows a custom limit below the maximum', () => {
    const url = buildLokiProxyUrl(GRAFANA, LOKI_UID, '{service="all"}', 250);
    expect(url).toContain('limit=250');
  });

  it('rejects a blank query', () => {
    expect(() => buildLokiProxyUrl(GRAFANA, LOKI_UID, '')).toThrow();
    expect(() => buildLokiProxyUrl(GRAFANA, LOKI_UID, '   ')).toThrow();
  });

  it('rejects a negative limit', () => {
    expect(() =>
      buildLokiProxyUrl(GRAFANA, LOKI_UID, '{service="all"}', -1),
    ).toThrow();
  });

  it('rejects an empty lokiUid', () => {
    expect(() =>
      buildLokiProxyUrl(GRAFANA, '', '{service="all"}'),
    ).toThrow();
  });
});

describe('buildTempoTraceUrl', () => {
  const GRAFANA = 'https://grafana.xopure.com';
  const TEMPO_UID = 'def456';

  it('uses /api/datasources/proxy/uid/<uid>/tempo/api/traces/<traceID>', () => {
    const url = buildTempoTraceUrl(GRAFANA, TEMPO_UID, 'trace-abc');
    expect(url).toBe(
      `${GRAFANA}/api/datasources/proxy/uid/${TEMPO_UID}/tempo/api/traces/trace-abc`,
    );
  });

  it('rejects a blank trace ID', () => {
    expect(() => buildTempoTraceUrl(GRAFANA, TEMPO_UID, '')).toThrow();
    expect(() => buildTempoTraceUrl(GRAFANA, TEMPO_UID, '   ')).toThrow();
  });

  it('rejects an empty tempoUid', () => {
    expect(() => buildTempoTraceUrl(GRAFANA, '', 'trace-1')).toThrow();
  });
});

describe('buildProxyHeaders', () => {
  it('returns an Authorization Bearer header with the API key', () => {
    const headers = buildProxyHeaders('my-api-key');
    expect(headers).toEqual({ Authorization: 'Bearer my-api-key' });
  });

  it('rejects an empty API key', () => {
    expect(() => buildProxyHeaders('')).toThrow();
    expect(() => buildProxyHeaders('   ')).toThrow();
  });
});
