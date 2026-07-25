import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { type HTTPMethod } from 'twenty-sdk/define';
import { TEMPO_TRACE_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { handleTempoTrace } from 'src/logic-functions/handlers/get-tempo-trace-handler';

/**
 * Input: { traceId: string; start?: string; end?: string }
 * Output: { status: number; trace: unknown; error?: string }
 */
const handler = async (event: RoutePayload) => handleTempoTrace(event);

export default defineLogicFunction({
  universalIdentifier: TEMPO_TRACE_FUNCTION_ID,
  name: 'xopure-get-tempo-trace',
  description: 'Retrieve a trace from Grafana Tempo via the authenticated proxy handler.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/xopure-logging/tempo/trace',
    httpMethod: 'POST' as HTTPMethod,
    isAuthRequired: true,
  },
});
