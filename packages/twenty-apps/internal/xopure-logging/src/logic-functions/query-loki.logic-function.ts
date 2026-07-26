import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { type HTTPMethod } from 'twenty-sdk/define';
import { LOKI_QUERY_FUNCTION_ID } from '../constants/universal-identifiers';
import { handleLokiQuery } from './handlers/query-loki-handler';

/**
 * Input: { query: string; start?: string; end?: string; limit?: number }
 * Output: { status: number; results: unknown[]; error?: string }
 */
const handler = async (event: RoutePayload) => handleLokiQuery(event);

export default defineLogicFunction({
  universalIdentifier: LOKI_QUERY_FUNCTION_ID,
  name: 'xopure-query-loki',
  description: 'Query Grafana Loki logs via the authenticated proxy handler.',
  timeoutSeconds: 30,
  handler,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Loki LogQL query.',
        },
        start: {
          type: 'string',
          description: 'Optional range start as RFC3339 or Loki-compatible timestamp.',
        },
        end: {
          type: 'string',
          description: 'Optional range end as RFC3339 or Loki-compatible timestamp.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 5000,
          description: 'Maximum log streams or entries to return.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  httpRouteTriggerSettings: {
    path: '/xopure-logging/loki/query',
    httpMethod: 'POST' as HTTPMethod,
    isAuthRequired: true,
  },
});
