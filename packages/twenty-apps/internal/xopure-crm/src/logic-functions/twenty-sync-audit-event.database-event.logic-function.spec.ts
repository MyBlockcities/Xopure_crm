import { describe, expect, it, vi } from 'vitest';

import logicFunctionConfig, {
  handler,
} from './twenty-sync-audit-event.database-event.logic-function';

describe('twenty sync audit event handler', () => {
  it('registers as a catch-all database event trigger for XO filtering', () => {
    expect(
      (
        logicFunctionConfig as {
          config?: { databaseEventTriggerSettings?: { eventName?: string } };
        }
      ).config?.databaseEventTriggerSettings?.eventName,
    ).toBe('*.*');
  });

  it('emits a sanitized XO entity audit event without raw payload values', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await handler({
      name: 'xopureSupportTicket.updated',
      recordId: 'ticket-1',
      updatedFields: ['status', 'requesterEmail'],
      payload: {
        subject: 'Leaked ticket subject',
        requesterEmail: 'customer@example.test',
        token: 'secret-token',
      },
    });

    expect(result).toMatchObject({
      success: true,
      eventName: 'xopureSupportTicket.updated',
      recordId: 'ticket-1',
      entityType: 'xopureSupportTicket',
      entityId: 'ticket-1',
      action: 'updated',
      changedFieldNames: ['status', 'requesterEmail'],
    });
    expect(infoSpy).toHaveBeenCalledWith(
      'xopure_entity_audit',
      expect.objectContaining({
        entityType: 'xopureSupportTicket',
        entityId: 'ticket-1',
        action: 'updated',
        source: 'twenty_database_event',
        result: 'success',
        changedFieldNames: ['status', 'requesterEmail'],
        durationMs: expect.any(Number),
      }),
    );
    const serializedLog = JSON.stringify(infoSpy.mock.calls);

    expect(serializedLog).not.toContain('Leaked ticket subject');
    expect(serializedLog).not.toContain('customer@example.test');
    expect(serializedLog).not.toContain('secret-token');
    infoSpy.mockRestore();
  });

  it('ignores non-XO event names without logging', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await handler({ eventName: 'custom.event', recordId: 'id-1' });

    expect(result).toMatchObject({
      success: true,
      entityType: 'unknown',
      action: 'unknown',
    });
    expect(infoSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });
});
