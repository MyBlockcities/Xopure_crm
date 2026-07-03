import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/define';

import { LOKI_QUERY_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { lokiQueryHandler } from 'src/logic-functions/handlers/loki-query-handler';

const handler = async (event: RoutePayload) => {
  const body = (event.body ?? {}) as { query?: string; limit?: number };

  return lokiQueryHandler({
    query: body.query ?? '',
    limit: body.limit,
  });
};

export default defineLogicFunction({
  universalIdentifier: LOKI_QUERY_FUNCTION_ID,
  name: 'xopure-logging-query-loki',
  description: 'Proxy authenticated Loki queries through Grafana without exposing Grafana credentials to browser code.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/xopure-logging/loki/query',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  workflowActionTriggerSettings: {
    label: 'Query XO Logging Loki',
    inputSchema: [
      {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    ],
    outputSchema: [
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          data: { type: 'object' },
        },
      },
    ],
  },
});
