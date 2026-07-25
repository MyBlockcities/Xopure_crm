import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { type HTTPMethod } from 'twenty-sdk/define';
import { LOKI_QUERY_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { handleLokiQuery } from 'src/logic-functions/handlers/query-loki-handler';

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
  httpRouteTriggerSettings: {
    path: '/xopure-logging/loki/query',
    httpMethod: 'POST' as HTTPMethod,
    isAuthRequired: true,
  },
});
