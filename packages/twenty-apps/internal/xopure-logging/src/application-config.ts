import { defineApplication } from 'twenty-sdk/define';
import { APPLICATION_ID, DEFAULT_ROLE_ID, GRAFANA_URL_VAR_ID, GRAFANA_API_KEY_VAR_ID, LOKI_UID_VAR_ID, TEMPO_UID_VAR_ID } from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_ID,
  displayName: 'XO Pure Logging',
  description: 'Logging and observability panel for XO Pure — Grafana, Loki, and Tempo integration.',
  defaultRoleUniversalIdentifier: DEFAULT_ROLE_ID,
  applicationVariables: {
    GRAFANA_URL: {
      universalIdentifier: GRAFANA_URL_VAR_ID,
      description: 'Base URL for the Grafana instance.',
      value: 'https://hetz.cyprus-ling.ts.net:3333',
      isSecret: false,
    },
    GRAFANA_API_KEY: {
      universalIdentifier: GRAFANA_API_KEY_VAR_ID,
      description: 'API key for Grafana datasource proxy authentication.',
      isSecret: true,
    },
    LOKI_DATASOURCE_UID: {
      universalIdentifier: LOKI_UID_VAR_ID,
      description: 'Grafana Loki datasource UID for log queries.',
      value: 'loki',
      isSecret: false,
    },
    TEMPO_DATASOURCE_UID: {
      universalIdentifier: TEMPO_UID_VAR_ID,
      description: 'Grafana Tempo datasource UID for trace queries.',
      value: 'tempo',
      isSecret: false,
    },
  },
});
