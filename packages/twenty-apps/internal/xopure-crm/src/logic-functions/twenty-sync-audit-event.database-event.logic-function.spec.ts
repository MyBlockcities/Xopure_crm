import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  defineLogicFunction: vi.fn((config: unknown) => config),
  emitSoc2Event: vi.fn(() => ({
    record: {
      event_hash: 'soc2-event-hash',
      previous_event_hash: 'genesis',
      schema_valid: true,
    },
    validation: { success: true },
  })),
}));

vi.mock('twenty-sdk/define', () => ({
  defineLogicFunction: mocks.defineLogicFunction,
}));

vi.mock('../compliance/soc2-event-emitter', () => ({
  emitSoc2Event: mocks.emitSoc2Event,
}));

import { handler } from './twenty-sync-audit-event.database-event.logic-function';

describe('twenty-sync-audit-event handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('audit event emission', () => {
    it('emits a sanitized structured console event for a created XO object', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await handler({
        recordId: 'rec-001',
        eventName: 'xo.person.created',
        payload: { email: 'test@example.com', name: 'Alice', ssn: '123-45-6789' },
      });

      // Output contract
      expect(result).toMatchObject({
        success: true,
        eventName: 'xo.person.created',
        recordId: 'rec-001',
      });
      expect(result).toHaveProperty('entityType', 'person');
      expect(result).toHaveProperty('action', 'created');
      expect(result).toHaveProperty('processedAt');
      expect(result).toHaveProperty('soc2SchemaValid', true);
      expect(result).toHaveProperty('soc2EventHash', 'soc2-event-hash');

      // Console event emitted exactly once
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const auditEvent = consoleSpy.mock.calls[0][0];

      // Sanitized fields present
      expect(auditEvent).toMatchObject({
        entityType: 'person',
        entityId: 'rec-001',
        action: 'created',
        result: 'success',
      });
      expect(auditEvent).toHaveProperty('durationMs');
      expect(typeof auditEvent.durationMs).toBe('number');

      // Raw payload values MUST NOT appear in the console event
      const eventString = JSON.stringify(auditEvent);
      // The event should mention field names if present
      expect(eventString).not.toContain('test@example.com');
      expect(eventString).not.toContain('Alice');
      expect(eventString).not.toContain('123-45-6789');
      expect(eventString).not.toContain('ssn');

      expect(mocks.emitSoc2Event).toHaveBeenCalledTimes(1);
      expect(mocks.emitSoc2Event).toHaveBeenCalledWith({
        schemaName: 'audit_event',
        record: expect.objectContaining({
          schema_version: '1.0',
          event_id: 'xo.person.created:rec-001',
          event_type: 'xo.person.created',
          actor_id: 'system',
          actor_role: 'db_trigger',
          action: 'created',
          resource_type: 'person',
          resource_id: 'rec-001',
          decision: 'allow',
          reason_code: 'DB_EVENT_TRIGGER',
          policy_version: 'twenty-sync-audit-event.v1',
          trace_id: 'xo.person.created:rec-001',
          request_id: 'rec-001',
          source_ip: 'db_trigger',
          retention_class: 'standard',
          redaction_class: 'internal',
        }),
      });

      consoleSpy.mockRestore();
    });

    it('passes payload actor and Tailnet enrichment into the SOC2 audit event', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handler({
        recordId: 'rec-006',
        eventName: 'xo.admin.updated',
        payload: {
          actor_id: 'user-admin-001',
          actor_role: 'admin',
          trace_id: 'trace-001',
          request_id: 'req-001',
          source_ip: '100.64.0.10',
          tailnet_node: 'crm-gateway',
          tailnet_user: 'admin@xopure.tailnet',
          tailnet_tags: ['tag:xopure-dev-crm'],
        },
      });

      expect(mocks.emitSoc2Event).toHaveBeenCalledTimes(1);
      expect(mocks.emitSoc2Event).toHaveBeenCalledWith({
        schemaName: 'audit_event',
        record: expect.objectContaining({
          actor_id: 'user-admin-001',
          actor_role: 'admin',
          trace_id: 'trace-001',
          request_id: 'req-001',
          source_ip: '100.64.0.10',
          tailnet_node: 'crm-gateway',
          tailnet_user: 'admin@xopure.tailnet',
          tailnet_tags: ['tag:xopure-dev-crm'],
        }),
      });

      consoleSpy.mockRestore();
    });

    it('emits a sanitized structured console event for an updated XO object with changed fields', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await handler({
        recordId: 'rec-002',
        eventName: 'xo.contact.updated',
        updatedFields: ['email', 'phone'],
        payload: {
          email: 'new@example.com',
          phone: '+15551234567',
          previousValues: { email: 'old@example.com' },
        },
      });

      expect(result).toMatchObject({
        success: true,
        eventName: 'xo.contact.updated',
        recordId: 'rec-002',
        entityType: 'contact',
        action: 'updated',
      });
      expect(result).toHaveProperty('changedFields');
      expect(result.changedFields).toEqual(expect.arrayContaining(['email', 'phone']));

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const auditEvent = consoleSpy.mock.calls[0][0];

      expect(auditEvent).toMatchObject({
        entityType: 'contact',
        entityId: 'rec-002',
        action: 'updated',
        changedFields: ['email', 'phone'],
        result: 'success',
      });
      expect(auditEvent).toHaveProperty('durationMs');

      // Raw payload values MUST NOT be logged
      const eventString = JSON.stringify(auditEvent);
      expect(eventString).not.toContain('new@example.com');
      expect(eventString).not.toContain('+15551234567');
      expect(eventString).not.toContain('old@example.com');
      expect(eventString).not.toContain('previousValues');

      consoleSpy.mockRestore();
    });

    it('emits a sanitized structured console event for a deleted XO object', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await handler({
        recordId: 'rec-003',
        eventName: 'xo.company.deleted',
      });

      expect(result).toMatchObject({
        success: true,
        eventName: 'xo.company.deleted',
        recordId: 'rec-003',
        entityType: 'company',
        action: 'deleted',
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const auditEvent = consoleSpy.mock.calls[0][0];

      expect(auditEvent).toMatchObject({
        entityType: 'company',
        entityId: 'rec-003',
        action: 'deleted',
        result: 'success',
      });
      expect(auditEvent).toHaveProperty('durationMs');

      consoleSpy.mockRestore();
    });

    it('falls back to unknown action when eventName is unrecognized', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await handler({
        recordId: 'rec-004',
        eventName: 'custom.event',
      });

      expect(result).toMatchObject({
        success: true,
        action: 'unknown',
      });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toMatchObject({
        action: 'unknown',
        result: 'success',
      });

      consoleSpy.mockRestore();
    });

    it('handles missing eventName gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await handler({
        recordId: 'rec-005',
      });

      expect(result).toMatchObject({
        success: true,
        action: 'unknown',
        entityType: 'unknown',
      });
      expect(result.eventName).toBe('twenty-sync-audit-event.*');

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const auditEvent = consoleSpy.mock.calls[0][0];
      expect(auditEvent).toMatchObject({
        action: 'unknown',
        entityType: 'unknown',
        result: 'success',
      });

      consoleSpy.mockRestore();
    });
  });
});
