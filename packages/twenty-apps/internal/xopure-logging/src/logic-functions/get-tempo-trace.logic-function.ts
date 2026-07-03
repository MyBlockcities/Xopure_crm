import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/define';

import { TEMPO_TRACE_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { tempoTraceHandler } from 'src/logic-functions/handlers/tempo-trace-handler';

const handler = async (event: RoutePayload) => {
  const body = (event.body ?? {}) as { traceId?: string };

  return tempoTraceHandler({ traceId: body.traceId ?? '' });
};

export default defineLogicFunction({
  universalIdentifier: TEMPO_TRACE_FUNCTION_ID,
  name: 'xopure-logging-get-tempo-trace',
  description: 'Proxy authenticated Tempo trace lookups through Grafana without exposing Grafana credentials to browser code.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/xopure-logging/tempo/trace',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  workflowActionTriggerSettings: {
    label: 'Get XO Logging Tempo Trace',
    inputSchema: [
      {
        type: 'object',
        properties: {
          traceId: { type: 'string' },
        },
        required: ['traceId'],
      },
    ],
    outputSchema: [
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' },
          trace: { type: 'object' },
        },
      },
    ],
  },
});
