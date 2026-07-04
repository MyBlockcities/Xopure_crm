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
  soc2RbacDecisionHash?: string;
  soc2ClaimReviewHash?: string;
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

const readPayloadBoolean = (
  payload: Record<string, unknown> | undefined,
  field: string,
): boolean | undefined => {
  const value = payload?.[field];

  return typeof value === 'boolean' ? value : undefined;
};

const normalizeDecision = (value: string | undefined): 'allow' | 'deny' | 'error' => {
  if (value === 'deny' || value === 'error') {
    return value;
  }

  return 'allow';
};

const normalizeClaimAuthorType = (
  value: string | undefined,
): 'ambassador' | 'admin' | 'system' | undefined => {
  if (value === 'ambassador' || value === 'admin' || value === 'system') {
    return value;
  }

  return undefined;
};

const normalizeClaimCategory = (
  value: string | undefined,
): 'wellness' | 'income' | 'product' | 'testimonial' | 'education' | undefined => {
  if (
    value === 'wellness' ||
    value === 'income' ||
    value === 'product' ||
    value === 'testimonial' ||
    value === 'education'
  ) {
    return value;
  }

  return undefined;
};

const normalizeClaimReviewStatus = (
  value: string | undefined,
): 'approved' | 'rejected' | 'needs_revision' | undefined => {
  if (value === 'approved' || value === 'rejected' || value === 'needs_revision') {
    return value;
  }

  return undefined;
};

const shouldEmitRbacDecision = (
  eventName: string,
  payload: Record<string, unknown> | undefined,
): boolean =>
  Boolean(
    readPayloadString(payload, 'rbac_resource') ||
      readPayloadString(payload, 'rbac_action') ||
      readPayloadString(payload, 'rbac_decision') ||
      eventName.includes('role') ||
      eventName.includes('permission') ||
      eventName.includes('rbac'),
  );

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
  const rbacResult = shouldEmitRbacDecision(eventName, input.payload)
    ? emitSoc2Event({
        schemaName: 'rbac_decision',
        record: {
          schema_version: '1.0',
          actor_id: readPayloadString(input.payload, 'actor_id') ?? 'system',
          actor_role:
            readPayloadString(input.payload, 'actor_role') ?? 'db_trigger',
          action:
            readPayloadString(input.payload, 'rbac_action') ??
            readPayloadString(input.payload, 'action') ??
            action,
          resource:
            readPayloadString(input.payload, 'rbac_resource') ??
            `${entityType}:${input.recordId ?? 'unknown-record'}`,
          decision: normalizeDecision(
            readPayloadString(input.payload, 'rbac_decision') ??
              readPayloadString(input.payload, 'decision'),
          ),
          reason_code:
            readPayloadString(input.payload, 'rbac_reason_code') ??
            readPayloadString(input.payload, 'reason_code') ??
            'RBAC_POLICY_MATCH',
          policy_version:
            readPayloadString(input.payload, 'rbac_policy_version') ??
            readPayloadString(input.payload, 'policy_version') ??
            'xopure-rbac.v1',
          expires_at:
            readPayloadString(input.payload, 'rbac_expires_at') ??
            readPayloadString(input.payload, 'expires_at') ??
            new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          evaluated_at_utc: processedAt,
          tailscale_identity: readPayloadString(input.payload, 'tailscale_identity'),
          jwt_jti: readPayloadString(input.payload, 'jwt_jti'),
          jit_grant_id: readPayloadString(input.payload, 'jit_grant_id'),
          retention_class: 'standard',
          redaction_class: 'internal',
        },
      })
    : undefined;
  const claimAuthorType = normalizeClaimAuthorType(
    readPayloadString(input.payload, 'claim_author_type') ??
      readPayloadString(input.payload, 'claimAuthorType'),
  );
  const claimCategory = normalizeClaimCategory(
    readPayloadString(input.payload, 'claim_category') ??
      readPayloadString(input.payload, 'claimCategory'),
  );
  const claimReviewStatus = normalizeClaimReviewStatus(
    readPayloadString(input.payload, 'review_status') ??
      readPayloadString(input.payload, 'reviewStatus'),
  );
  const claimId =
    readPayloadString(input.payload, 'claim_id') ??
    readPayloadString(input.payload, 'claimId');
  const claimText =
    readPayloadString(input.payload, 'claim_text') ??
    readPayloadString(input.payload, 'claimText');
  const claimChannel =
    readPayloadString(input.payload, 'claim_channel') ??
    readPayloadString(input.payload, 'claimChannel');
  const reviewerId =
    readPayloadString(input.payload, 'reviewer_id') ??
    readPayloadString(input.payload, 'reviewerId') ??
    readPayloadString(input.payload, 'actor_id');
  const claimResult =
    claimId &&
    claimText &&
    claimChannel &&
    claimAuthorType &&
    claimCategory &&
    claimReviewStatus &&
    reviewerId
      ? emitSoc2Event({
          schemaName: 'claim_review',
          record: {
            schema_version: '1.0',
            claim_id: claimId,
            claim_text: claimText,
            claim_channel: claimChannel,
            claim_author_type: claimAuthorType,
            claim_category: claimCategory,
            prohibited_terms_detected:
              readPayloadBoolean(input.payload, 'prohibited_terms_detected') ??
              readPayloadBoolean(input.payload, 'prohibitedTermsDetected') ??
              false,
            requires_disclosure:
              readPayloadBoolean(input.payload, 'requires_disclosure') ??
              readPayloadBoolean(input.payload, 'requiresDisclosure') ??
              false,
            disclosure_present:
              readPayloadBoolean(input.payload, 'disclosure_present') ??
              readPayloadBoolean(input.payload, 'disclosurePresent') ??
              false,
            substantiation_required:
              readPayloadBoolean(input.payload, 'substantiation_required') ??
              readPayloadBoolean(input.payload, 'substantiationRequired') ??
              false,
            substantiation_asset_id:
              readPayloadString(input.payload, 'substantiation_asset_id') ??
              readPayloadString(input.payload, 'substantiationAssetId'),
            review_status: claimReviewStatus,
            reviewer_id: reviewerId,
            reviewed_at_utc:
              readPayloadString(input.payload, 'reviewed_at_utc') ??
              readPayloadString(input.payload, 'reviewedAtUtc') ??
              processedAt,
            retention_class: 'standard',
            redaction_class: 'confidential',
          },
        })
      : undefined;

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
    soc2RbacDecisionHash: rbacResult?.record.event_hash,
    soc2ClaimReviewHash: claimResult?.record.event_hash,
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
          soc2RbacDecisionHash: { type: 'string' },
          soc2ClaimReviewHash: { type: 'string' },
        },
      },
    ],
  },
});
