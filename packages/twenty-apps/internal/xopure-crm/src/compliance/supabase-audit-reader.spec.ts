import { describe, expect, it, vi } from 'vitest';

import { SupabaseAuditReader } from './supabase-audit-reader';

const jsonResponse = (
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: async () => body,
}) as Response;

describe('SupabaseAuditReader', () => {
  it('reads successful sync and activity rows from the CRM schema', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 'sync-1',
          created_at: '2026-07-04T12:00:00.000Z',
          status: 'success',
          payload_hash: '',
        },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        {
          id: 'activity-1',
          created_at: '2026-07-04T12:01:00.000Z',
          status: 'sent',
          payload: { taskId: 'task-1' },
        },
      ])) as unknown as typeof fetch;
    const reader = new SupabaseAuditReader(
      'https://supabase.local/',
      'service-key',
      fetchMock,
    );

    const rows = await reader.fetchUnsyncedRows(
      new Date('2026-07-04T00:00:00.000Z'),
      25,
    );

    expect(rows).toEqual([
      expect.objectContaining({
        audit_source: 'twenty_sync_audit',
        id: 'sync-1',
        payload_hash: '',
      }),
      expect.objectContaining({
        audit_source: 'twenty_activity_log',
        id: 'activity-1',
      }),
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://supabase.local/rest/v1/twenty_sync_audit?select=*&status=eq.success&created_at=gt.2026-07-04T00%3A00%3A00.000Z&order=created_at.asc&limit=25',
      {
        headers: {
          apikey: 'service-key',
          Authorization: 'Bearer service-key',
          'Accept-Profile': 'crm',
        },
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://supabase.local/rest/v1/twenty_activity_log?select=*&status=in.(sent,confirmed)&created_at=gt.2026-07-04T00%3A00%3A00.000Z&order=created_at.asc&limit=25',
      {
        headers: {
          apikey: 'service-key',
          Authorization: 'Bearer service-key',
          'Accept-Profile': 'crm',
        },
      },
    );
  });

  it('returns an empty list when Supabase is unreachable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const reader = new SupabaseAuditReader(
      'https://supabase.local',
      'service-key',
      fetchMock,
    );

    await expect(reader.fetchUnsyncedRows(new Date(), 10)).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to read Supabase audit rows for SOC2 evidence.',
      expect.any(Error),
    );
  });
});
