import { describe, expect, it, vi } from 'vitest';

import { CompApiClient } from './comp-api-client';

const jsonResponse = (
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: async () => body,
}) as Response;

const createFetch = (response: Response) =>
  vi.fn(async () => response) as unknown as typeof fetch;

describe('CompApiClient', () => {
  it('submits evidence forms to the upload-submission endpoint with API key auth', async () => {
    const fetchMock = createFetch(jsonResponse({ id: 'submission-1' }));
    const client = new CompApiClient(
      'http://comp.local/',
      'comp-key',
      fetchMock,
    );

    const payload = {
      schema_name: 'audit_event',
      event_hash: 'hash-1',
      actor: 'agent',
    };

    const result = await client.submitEvidenceForm('board-meeting', payload);

    expect(result).toEqual({ ok: true, submissionId: 'submission-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://comp.local/v1/evidence-forms/board-meeting/upload-submission',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'comp-key',
        },
      },
    );
  });

  it('returns auth failure without calling Comp when the API key is missing', async () => {
    const fetchMock = createFetch(jsonResponse({ id: 'submission-1' }));
    const client = new CompApiClient('http://comp.local', undefined, fetchMock);

    const result = await client.submitEvidenceForm('board-meeting', {});

    expect(result).toEqual({ ok: false, error: 'Comp auth failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 401 and 5xx responses to structured errors', async () => {
    const authClient = new CompApiClient(
      'http://comp.local',
      'bad-key',
      createFetch(jsonResponse({}, { ok: false, status: 401 })),
    );
    const serverClient = new CompApiClient(
      'http://comp.local',
      'comp-key',
      createFetch(jsonResponse({}, { ok: false, status: 503 })),
    );

    await expect(authClient.submitEvidenceForm('board-meeting', {}))
      .resolves.toEqual({ ok: false, error: 'Comp auth failed' });
    await expect(serverClient.submitEvidenceForm('board-meeting', {}))
      .resolves.toEqual({ ok: false, error: 'Comp 5xx' });
  });

  it('requires approverId and sends it for submit-for-review', async () => {
    const fetchMock = createFetch(jsonResponse({ ok: true }));
    const client = new CompApiClient(
      'http://comp.local',
      'comp-key',
      fetchMock,
    );

    await expect(client.updateTask('task-1', 'submit-for-review'))
      .resolves.toEqual({
        ok: false,
        error: 'Comp submit-for-review requires approverId',
      });

    const result = await client.updateTask('task-1', 'submit-for-review', {
      approverId: 'user-1',
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://comp.local/v1/tasks/task-1/submit-for-review',
      {
        method: 'POST',
        body: JSON.stringify({ approverId: 'user-1' }),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'comp-key',
        },
      },
    );
  });

  it('checks Comp health without throwing on network failures', async () => {
    const healthyClient = new CompApiClient(
      'http://comp.local',
      'comp-key',
      createFetch(jsonResponse({ status: 'ok' })),
    );
    const failingFetch = vi.fn(async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    const unhealthyClient = new CompApiClient(
      'http://comp.local',
      'comp-key',
      failingFetch,
    );

    await expect(healthyClient.heartbeat()).resolves.toBe(true);
    await expect(unhealthyClient.heartbeat()).resolves.toBe(false);
  });
});
