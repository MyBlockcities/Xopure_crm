import { describe, expect, it } from 'vitest';

import applicationConfig from 'src/application-config';

describe('xopure-logging application config', () => {
  it('exports a defineApplication result with displayName containing Logging', () => {
    expect(applicationConfig).toBeDefined();
    expect(applicationConfig.config.displayName).toMatch(/logging/i);
  });

  it('declares GRAFANA_URL as a non-secret variable', () => {
    const grafanaUrl = applicationConfig.config.applicationVariables?.GRAFANA_URL;
    expect(grafanaUrl).toBeDefined();
    expect(grafanaUrl.isSecret).toBe(false);
    expect(grafanaUrl.description).toBeDefined();
  });

  it('declares GRAFANA_API_KEY as a secret variable', () => {
    const apiKey = applicationConfig.config.applicationVariables?.GRAFANA_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey.isSecret).toBe(true);
    expect(apiKey.description).toBeDefined();
  });

  it('declares LOKI_DATASOURCE_UID as a non-secret variable', () => {
    const lokiUid = applicationConfig.config.applicationVariables?.LOKI_DATASOURCE_UID;
    expect(lokiUid).toBeDefined();
    expect(lokiUid.isSecret).toBe(false);
    expect(lokiUid.description).toBeDefined();
  });

  it('declares TEMPO_DATASOURCE_UID as a non-secret variable', () => {
    const tempoUid = applicationConfig.config.applicationVariables?.TEMPO_DATASOURCE_UID;
    expect(tempoUid).toBeDefined();
    expect(tempoUid.isSecret).toBe(false);
    expect(tempoUid.description).toBeDefined();
  });

  it('has exactly the 4 expected application variables', () => {
    const vars = applicationConfig.config.applicationVariables ?? {};
    const keys = Object.keys(vars).sort();
    expect(keys).toEqual([
      'GRAFANA_API_KEY',
      'GRAFANA_URL',
      'LOKI_DATASOURCE_UID',
      'TEMPO_DATASOURCE_UID',
    ]);
  });

  it('assigns a universalIdentifier', () => {
    expect(applicationConfig.config.universalIdentifier).toBeDefined();
    expect(typeof applicationConfig.config.universalIdentifier).toBe('string');
  });
});
