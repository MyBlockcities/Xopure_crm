import { defineLogicFunction } from 'twenty-sdk/define';

import { emitSoc2Event } from '../compliance/soc2-event-emitter';

type Action = 'created' | 'updated' | 'deleted' | 'unknown';

type Input = {
  recordId?: string;
  eventName?: string;
  updatedFields?: string[];
  payload?: Record<string, unknown>;
};

type Output = {
  success: boolean;
  eventName: string;
  recordId?: string;
  entityType?: string;
  action?: string;
  changedFields?: string[];
  durationMs?: number;
  processedAt: string;
  soc2SchemaValid?: boolean;
  soc2EventHash?: string;
};

type AuditEvent = {
  entityType: string;
  entityId?: string;
  action: Action;
  changedFields?: string[];
  result: 'success' | 'error';
  durationMs: number;
};

const XO_EVENT_RE = /^xo\.([^.]+)\.([^.]+)$/;

const parseEventName = (eventName?: string): { entityType: string; action: Action } => {
  if (!eventName) return { entityType: 'unknown', action: 'unknown' };
  const match = eventName.match(XO_EVENT_RE);
  if (!match) return { entityType: 'unknown', action: 'unknown' };
  const rawAction = match[2];
  const normalizedAction: Action =
    rawAction === 'created' || rawAction === 'updated' || rawAction === 'deleted'
      ? rawAction
      : 'unknown';
  return { entityType: match[1], action: normalizedAction };
};

const readPayloadString = (
  payload: Record<string, unknown> | undefined,
  field: string,
): string | undefined => {
  const value = payload?.[field];

  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
};

const readPayloadStringArray = (
  payload: Record<string, unknown> | undefined,
  field: string,
): string[] | undefined => {
  const value = payload?.[field];

  return Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
    ? value
    : undefined;
};

export const handler = async (input: Input): Promise<Output> => {
  const start = performance.now();
  const { entityType, action } = parseEventName(input.eventName);
  const eventName = input.eventName ?? 'twenty-sync-audit-event.*';

  const auditEvent: AuditEvent = {
    entityType,
    entityId: input.recordId,
    action,
    changedFields: input.updatedFields?.length ? [...input.updatedFields] : undefined,
    result: 'success',
    durationMs: 0,
  };

  auditEvent.durationMs = performance.now() - start;

  console.log(auditEvent);

  const processedAt = new Date().toISOString();
  const soc2Result = emitSoc2Event({
    schemaName: 'audit_event',
    record: {
      schema_version: '1.0',
      event_id: `${eventName}:${input.recordId ?? 'unknown-record'}`,
      event_type: eventName,
      occurred_at_utc: processedAt,
      actor_id: readPayloadString(input.payload, 'actor_id') ?? 'system',
      actor_role: readPayloadString(input.payload, 'actor_role') ?? 'db_trigger',
      action,
      resource_type: entityType,
      resource_id: input.recordId ?? 'unknown-record',
      decision: 'allow',
      reason_code: 'DB_EVENT_TRIGGER',
      policy_version: 'twenty-sync-audit-event.v1',
      trace_id:
        readPayloadString(input.payload, 'trace_id') ??
        `${eventName}:${input.recordId ?? 'unknown-record'}`,
      request_id:
        readPayloadString(input.payload, 'request_id') ??
        input.recordId ??
        eventName,
      source_ip:
        readPayloadString(input.payload, 'source_ip') ??
        readPayloadString(input.payload, 'sourceIp') ??
        'db_trigger',
      tailnet_node: readPayloadString(input.payload, 'tailnet_node'),
      tailnet_user: readPayloadString(input.payload, 'tailnet_user'),
      tailnet_tags: readPayloadStringArray(input.payload, 'tailnet_tags'),
      retention_class: 'standard',
      redaction_class: 'internal',
      before_hash: readPayloadString(input.payload, 'before_hash'),
      after_hash: readPayloadString(input.payload, 'after_hash'),
    },
  });

  return {
    success: true,
    eventName,
    recordId: input.recordId,
    entityType,
    action,
    changedFields: auditEvent.changedFields,
    durationMs: Math.round(auditEvent.durationMs),
    processedAt,
    soc2SchemaValid: soc2Result.record.schema_valid === true,
    soc2EventHash: soc2Result.record.event_hash,
  };
};

export default defineLogicFunction({
  universalIdentifier: '18e7c423-57fb-4632-bf64-0d7389937af9',
  name: 'twenty-sync-audit-event',
  description: 'Database event workflow that reacts to TwentySyncAuditEvent record changes.',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: 'twenty-sync-audit-event.*',
  },
  workflowActionTriggerSettings: {
    label: 'Twenty Sync Audit Event Database Event',
    icon: 'IconDatabase',
    inputSchema: [
      {
        type: 'object',
        properties: {
          recordId: { type: 'string' },
          eventName: { type: 'string' },
          updatedFields: {
            type: 'array',
            items: { type: 'string' },
          },
          payload: { type: 'object' },
        },
      },
    ],
    outputSchema: [
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          eventName: { type: 'string' },
          recordId: { type: 'string' },
          entityType: { type: 'string' },
          action: { type: 'string' },
          changedFields: {
            type: 'array',
            items: { type: 'string' },
          },
          durationMs: { type: 'number' },
          processedAt: { type: 'string' },
          soc2SchemaValid: { type: 'boolean' },
          soc2EventHash: { type: 'string' },
        },
      },
    ],
  },
});
