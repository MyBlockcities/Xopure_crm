import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { type HTTPMethod } from 'twenty-sdk/define';
import { TEMPO_TRACE_FUNCTION_ID } from '../constants/universal-identifiers';
import { handleTempoTrace } from './handlers/get-tempo-trace-handler';

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
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        traceId: {
          type: 'string',
          description: 'Tempo trace ID as 16 or 32 hexadecimal characters.',
        },
        start: {
          type: 'string',
          description: 'Optional trace search start time.',
        },
        end: {
          type: 'string',
          description: 'Optional trace search end time.',
        },
      },
      required: ['traceId'],
      additionalProperties: false,
    },
  },
  httpRouteTriggerSettings: {
    path: '/xopure-logging/tempo/trace',
    httpMethod: 'POST' as HTTPMethod,
    isAuthRequired: true,
  },
});
