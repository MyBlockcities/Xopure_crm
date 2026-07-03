import { defineApplication } from 'twenty-sdk/define';

import {
  APPLICATION_ID,
  DEFAULT_ROLE_ID,
  GRAFANA_API_KEY_VAR_ID,
  GRAFANA_URL_VAR_ID,
  LOKI_UID_VAR_ID,
  TEMPO_UID_VAR_ID,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_ID,
  displayName: 'XO Pure Logging',
  description: 'Safe Grafana, Loki, and Tempo observability entry point for XO Pure CRM.',
  defaultRoleUniversalIdentifier: DEFAULT_ROLE_ID,
  applicationVariables: {
    GRAFANA_URL: {
      universalIdentifier: GRAFANA_URL_VAR_ID,
      description: 'Browser-safe Grafana base URL for embedded logging views.',
      value: 'https://hetz.cyprus-ling.ts.net:3333',
      isSecret: false,
    },
    GRAFANA_API_KEY: {
      universalIdentifier: GRAFANA_API_KEY_VAR_ID,
      description: 'Grafana service account token used only by server-side proxy functions.',
      isSecret: true,
    },
    LOKI_DATASOURCE_UID: {
      universalIdentifier: LOKI_UID_VAR_ID,
      description: 'Grafana datasource UID for Loki log queries.',
      value: 'loki',
      isSecret: false,
    },
    TEMPO_DATASOURCE_UID: {
      universalIdentifier: TEMPO_UID_VAR_ID,
      description: 'Grafana datasource UID for Tempo trace lookups.',
      value: 'tempo',
      isSecret: false,
    },
  },
});
