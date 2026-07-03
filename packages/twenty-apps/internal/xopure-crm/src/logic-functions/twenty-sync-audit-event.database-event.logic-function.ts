import { defineLogicFunction } from 'twenty-sdk/define';

type Input = {
  recordId?: string;
  eventName?: string;
  name?: string;
  updatedFields?: string[];
  payload?: Record<string, unknown>;
};

type Output = {
  success: boolean;
  eventName: string;
  recordId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  changedFieldNames: string[];
  processedAt: string;
};

type AuditEvent = {
  entityType: string;
  entityId?: string;
  action: string;
  source: 'twenty_database_event';
  result: 'success';
  changedFieldNames: string[];
  durationMs: number;
};

const parseEventName = (
  eventName: string,
): { entityType: string; action: string } => {
  const [entityType, action] = eventName.split('.');

  if (!entityType?.startsWith('xopure') || !action) {
    return { entityType: 'unknown', action: 'unknown' };
  }

  if (!['created', 'updated', 'deleted', 'upserted'].includes(action)) {
    return { entityType, action: 'unknown' };
  }

  return { entityType, action };
};

const getChangedFieldNames = (updatedFields?: string[]): string[] =>
  (updatedFields ?? []).filter((fieldName) => typeof fieldName === 'string');

export const handler = async (input: Input): Promise<Output> => {
  const startedAt = Date.now();
  const eventName = input.eventName ?? input.name ?? '*.*';
  const { entityType, action } = parseEventName(eventName);
  const changedFieldNames = getChangedFieldNames(input.updatedFields);
  const entityId = input.recordId;

  if (entityType === 'unknown') {
    return {
      success: true,
      eventName,
      recordId: input.recordId,
      entityType,
      entityId,
      action,
      changedFieldNames,
      processedAt: new Date().toISOString(),
    };
  }

  const auditEvent: AuditEvent = {
    entityType,
    entityId,
    action,
    source: 'twenty_database_event',
    result: 'success',
    changedFieldNames,
    durationMs: Date.now() - startedAt,
  };

  console.info('xopure_entity_audit', auditEvent);

  return {
    success: true,
    eventName,
    recordId: input.recordId,
    entityType,
    entityId,
    action,
    changedFieldNames,
    processedAt: new Date().toISOString(),
  };
};

export default defineLogicFunction({
  universalIdentifier: '18e7c423-57fb-4632-bf64-0d7389937af9',
  name: 'twenty-sync-audit-event',
  description: 'Database event workflow that reacts to TwentySyncAuditEvent record changes.',
  timeoutSeconds: 60,
  handler,
  databaseEventTriggerSettings: {
    eventName: '*.*',
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
          name: { type: 'string' },
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
          entityId: { type: 'string' },
          action: { type: 'string' },
          changedFieldNames: {
            type: 'array',
            items: { type: 'string' },
          },
          processedAt: { type: 'string' },
        },
      },
    ],
  },
});
