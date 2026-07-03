import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  client: {
    mutation: vi.fn(),
    query: vi.fn(),
  },
  CoreApiClient: vi.fn(),
  defineLogicFunction: vi.fn((config: unknown) => config),
}));

vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: mocks.CoreApiClient,
}));

vi.mock('twenty-sdk/define', () => ({
  defineLogicFunction: mocks.defineLogicFunction,
}));

import { handler } from './support-ticket-task-creator.database-event.logic-function';

const stubMulticaSuccess = () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ id: 'multica-issue-1', identifier: 'X0-99' }),
    text: async () => '',
  }));

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
};

describe('support ticket task creator handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.CoreApiClient.mockImplementation(function () {
      return mocks.client;
    });
    process.env.MULTICA_API_KEY = 'pat-test';
    // Default: no existing TaskTarget for any support ticket id
    mocks.client.query.mockResolvedValue({ taskTargets: { edges: [] } });
  });

  it('creates a Task, a Multica issue, and writes back the issue id', async () => {
    mocks.client.mutation
      .mockResolvedValueOnce({ createTask: { id: 'task-1' } })
      .mockResolvedValueOnce({ createTaskTarget: { id: 'task-target-1' } })
      .mockResolvedValueOnce({ updateXopureSupportTicket: { id: 'ticket-1' } });
    const fetchMock = stubMulticaSuccess();

    const result = await handler({
      record: {
        id: 'ticket-1',
        subject: 'Broken shipment',
        status: 'NEW',
        priority: 'HIGH',
        ticketNumber: 'T-100',
      },
    });

    expect(result).toMatchObject({
      success: true,
      taskId: 'task-1',
      supportTicketId: 'ticket-1',
      multicaIssueId: 'multica-issue-1',
    });
    expect(result.multicaError).toBeUndefined();
    expect(mocks.client.mutation).toHaveBeenCalledTimes(3);
    expect(mocks.client.mutation).toHaveBeenNthCalledWith(3, {
      updateXopureSupportTicket: {
        __args: {
          id: 'ticket-1',
          data: { multicaIssueId: 'multica-issue-1' },
        },
        id: true,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('workspace_id=d11337e4-0c4e-43b8-8fc8-8216c70f1427'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer pat-test',
          'Content-Type': 'application/json',
        },
      }),
    );
    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const callBody = JSON.parse(requestInit.body as string);

    expect(callBody).toMatchObject({
      title: 'Broken shipment',
      priority: 'high',
      status: 'todo',
      project_id: 'fb2e3c0e-27e0-47ac-b86d-3d2e18832fd6',
    });
  });

  it('skips Multica sync when multicaIssueId is already set', async () => {
    mocks.client.mutation
      .mockResolvedValueOnce({ createTask: { id: 'task-2' } })
      .mockResolvedValueOnce({ createTaskTarget: { id: 'task-target-2' } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await handler({
      record: {
        id: 'ticket-2',
        subject: 'Already synced',
        multicaIssueId: 'existing-issue-id',
      },
    });

    expect(result).toMatchObject({
      success: true,
      taskId: 'task-2',
      multicaIssueId: 'existing-issue-id',
    });
    expect(result.multicaError).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.client.mutation).toHaveBeenCalledTimes(2);
  });

  it('still creates the Task when the Multica API fails', async () => {
    mocks.client.mutation
      .mockResolvedValueOnce({ createTask: { id: 'task-3' } })
      .mockResolvedValueOnce({ createTaskTarget: { id: 'task-target-3' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
        text: async () => 'Service unavailable',
      })),
    );

    const result = await handler({
      record: {
        id: 'ticket-3',
        subject: 'Multica is down',
      },
    });

    expect(result).toMatchObject({
      success: true,
      taskId: 'task-3',
      supportTicketId: 'ticket-3',
    });
    expect(result.multicaIssueId).toBeUndefined();
    // Sanitized error includes status code but not raw response body
    expect(result.multicaError).toContain('503');
    expect(result.multicaError).not.toContain('Service unavailable');
  });

  it('links created tasks through targetXopureSupportTicketId', async () => {
    mocks.client.mutation
      .mockResolvedValueOnce({ createTask: { id: 'task-1' } })
      .mockResolvedValueOnce({ createTaskTarget: { id: 'task-target-1' } })
      .mockResolvedValueOnce({ updateXopureSupportTicket: { id: 'ticket-1' } });
    stubMulticaSuccess();

    const result = await handler({
      record: {
        id: 'ticket-1',
        subject: 'Broken shipment',
      },
    });

    expect(result).toMatchObject({
      success: true,
      taskId: 'task-1',
      supportTicketId: 'ticket-1',
    });
    expect(mocks.client.mutation).toHaveBeenNthCalledWith(2, {
      createTaskTarget: {
        __args: {
          data: {
            taskId: 'task-1',
            targetXopureSupportTicketId: 'ticket-1',
          },
        },
        id: true,
      },
    });
  });

  it('emits JOB_START and JOB_COMPLETE lifecycle events without ticket subject', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.client.mutation
      .mockResolvedValueOnce({ createTask: { id: 'task-1' } })
      .mockResolvedValueOnce({ createTaskTarget: { id: 'task-target-1' } })
      .mockResolvedValueOnce({ updateXopureSupportTicket: { id: 'ticket-1' } });
    stubMulticaSuccess();

    const result = await handler({
      record: {
        id: 'ticket-1',
        subject: 'Broken shipment',
      },
    });

    expect(result.taskId).toBe('task-1');
    expect(infoSpy).toHaveBeenCalledWith(
      'xopure_job_lifecycle',
      expect.objectContaining({
        stage: 'JOB_START',
        jobType: 'support-ticket-task-creator',
        supportTicketId: 'ticket-1',
        recordsProcessed: 0,
        recordsFailed: 0,
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      'xopure_job_lifecycle',
      expect.objectContaining({
        stage: 'JOB_COMPLETE',
        jobType: 'support-ticket-task-creator',
        supportTicketId: 'ticket-1',
        taskId: 'task-1',
        durationMs: expect.any(Number),
        recordsProcessed: 1,
        recordsFailed: 0,
      }),
    );
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('Broken shipment');
    infoSpy.mockRestore();
  });

  it('emits JOB_FAIL lifecycle event without leaking subject when creation fails', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.client.mutation.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      handler({
        record: {
          id: 'ticket-1',
          subject: 'Broken shipment',
        },
      }),
    ).rejects.toThrow('database unavailable');

    expect(infoSpy).toHaveBeenCalledWith(
      'xopure_job_lifecycle',
      expect.objectContaining({
        stage: 'JOB_FAIL',
        jobType: 'support-ticket-task-creator',
        supportTicketId: 'ticket-1',
        errorCode: 'UNHANDLED_ERROR',
        recordsProcessed: 0,
        recordsFailed: 1,
      }),
    );
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('Broken shipment');
    infoSpy.mockRestore();
  });

  it('reuses existing Task and TaskTarget on repeated invocation with same supportTicketId', async () => {
    // Given: a previous invocation already created a TaskTarget linking this ticket to a task
    mocks.client.query.mockResolvedValueOnce({
      taskTargets: {
        edges: [
          {
            node: {
              id: 'existing-target-1',
              task: { id: 'existing-task-1' },
            },
          },
        ],
      },
    });
    mocks.client.mutation
      .mockResolvedValueOnce({ updateXopureSupportTicket: { id: 'ticket-1' } });
    stubMulticaSuccess();

    const result = await handler({
      record: {
        id: 'ticket-1',
        subject: 'Repeated trigger',
        status: 'NEW',
        priority: 'HIGH',
      },
    });

    // Task is reused — no createTask/createTaskTarget mutations
    expect(result).toMatchObject({
      success: true,
      taskId: 'existing-task-1',
      supportTicketId: 'ticket-1',
      multicaIssueId: 'multica-issue-1',
    });
    expect(result.multicaError).toBeUndefined();
    // Only 1 mutation: updateXopureSupportTicket (write-back after Multica POST)
    expect(mocks.client.mutation).toHaveBeenCalledTimes(1);
    expect(mocks.client.mutation).toHaveBeenCalledWith({
      updateXopureSupportTicket: {
        __args: {
          id: 'ticket-1',
          data: { multicaIssueId: 'multica-issue-1' },
        },
        id: true,
      },
    });
  });

  it('reuses both multicaIssueId and existing TaskTarget, avoiding all mutations and Multica POST', async () => {
    // Given: existing TaskTarget + multicaIssueId already set
    mocks.client.query.mockResolvedValueOnce({
      taskTargets: {
        edges: [
          {
            node: {
              id: 'existing-target-2',
              task: { id: 'existing-task-2' },
            },
          },
        ],
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await handler({
      record: {
        id: 'ticket-2',
        subject: 'Already synced and linked',
        multicaIssueId: 'existing-multica-id',
      },
    });

    expect(result).toMatchObject({
      success: true,
      taskId: 'existing-task-2',
      supportTicketId: 'ticket-2',
      multicaIssueId: 'existing-multica-id',
    });
    expect(result.multicaError).toBeUndefined();
    // No mutations, no Multica POST
    expect(mocks.client.mutation).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sanitizes Multica API error body and lifecycle logs', async () => {
    mocks.client.mutation
      .mockResolvedValueOnce({ createTask: { id: 'task-1' } })
      .mockResolvedValueOnce({ createTaskTarget: { id: 'task-target-1' } });
    const sensitiveBody = JSON.stringify({
      error: 'validation failed',
      details: {
        email: 'customer@test.com',
        subject: 'Broken shipment',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 422,
        json: async () => ({}),
        text: async () => sensitiveBody,
      })),
    );
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await handler({
      record: {
        id: 'ticket-1',
        subject: 'Broken shipment',
        requesterEmail: 'customer@test.com',
      },
    });

    // multicaError contains status code but NOT raw body, email, subject, or token
    expect(result.multicaError).toContain('422');
    expect(result.multicaError).not.toContain('customer@test.com');
    expect(result.multicaError).not.toContain('Broken shipment');
    expect(result.multicaError).not.toContain('validation failed');
    // Lifecycle logs also sanitized
    const logged = JSON.stringify(infoSpy.mock.calls);
    expect(logged).not.toContain('customer@test.com');
    expect(logged).not.toContain('Broken shipment');
    infoSpy.mockRestore();
  });

  it('marks write-back failure in output when Multica POST succeeds but ticket update fails', async () => {
    mocks.client.mutation
      .mockResolvedValueOnce({ createTask: { id: 'task-1' } })
      .mockResolvedValueOnce({ createTaskTarget: { id: 'task-target-1' } })
      .mockRejectedValueOnce(new Error('Ticket not found'));
    stubMulticaSuccess();

    const result = await handler({
      record: {
        id: 'ticket-1',
        subject: 'Write-back will fail',
      },
    });

    // Success is true because Task and Multica issue were created
    expect(result).toMatchObject({
      success: true,
      taskId: 'task-1',
      supportTicketId: 'ticket-1',
      multicaIssueId: 'multica-issue-1',
    });
    // Write-back failure is marked without leaking response body
    expect(result.multicaError).toBe('TICKET_WRITE_BACK_FAIL');
  });
});
