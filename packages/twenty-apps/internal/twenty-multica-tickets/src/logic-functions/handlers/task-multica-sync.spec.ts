import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTaskMulticaIssueHandler } from 'src/logic-functions/handlers/create-task-multica-issue-handler';
import { updateTaskMulticaIssueHandler } from 'src/logic-functions/handlers/update-task-multica-issue-handler';
import { taskSyncWebhookHandler } from 'src/logic-functions/handlers/task-sync-webhook-handler';
import type { MulticaIssue, MulticaSyncClient } from 'src/logic-functions/types/multica.types';

const WORKSPACE_ID = 'd11337e4-0c4e-43b8-8fc8-8216c70f1427';
const PROJECT_ID = 'fb2e3c0e-27e0-47ac-b86d-3d2e18832fd6';

const makeIssue = (overrides: Partial<MulticaIssue> = {}): MulticaIssue => ({
  id: 'mc-issue-1',
  workspace_id: WORKSPACE_ID,
  number: 100,
  identifier: 'X0-100',
  title: 'Task sync issue',
  description: null,
  status: 'todo',
  priority: 'medium',
  assignee_type: null,
  assignee_id: null,
  creator_type: 'member',
  creator_id: 'creator-1',
  parent_issue_id: null,
  project_id: PROJECT_ID,
  position: -1,
  start_date: null,
  due_date: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  metadata: {},
  labels: [],
  ...overrides,
});

const stubFetch = (issue = makeIssue()) => {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: true,
        json: async () => issue,
        text: async () => '',
      }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const stubFetchError = (status: number, body: string) => {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: false,
        status,
        text: async () => body,
        json: async () => {
          throw new Error('Not JSON');
        },
      }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Create a mock MulticaSyncClient with vi.fn() methods. */
const mockClient = (): MulticaSyncClient => ({
  query: vi.fn(),
  mutation: vi.fn(),
});

beforeEach(() => {
  delete process.env.MULTICA_API_KEY;
  delete process.env.MULTICA_WEBHOOK_SECRET;
  vi.unstubAllGlobals();
});

afterEach(() => {
  delete process.env.MULTICA_API_KEY;
  delete process.env.MULTICA_WEBHOOK_SECRET;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// createTaskMulticaIssueHandler
// ---------------------------------------------------------------------------
describe('createTaskMulticaIssueHandler', () => {
  it('requires a MULTICA_API_KEY before creating an issue', async () => {
    const fetchMock = stubFetch();

    const result = await createTaskMulticaIssueHandler({
      id: 'task-1',
      title: 'New task',
    });

    expect(result).toEqual({
      success: false,
      error: 'Missing MULTICA_API_KEY environment variable.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a non-empty title', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch();

    const result = await createTaskMulticaIssueHandler({
      id: 'task-1',
      title: '   ',
    });

    expect(result).toEqual({
      success: false,
      error: '`title` is required.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates Multica issue and updates Twenty task record', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const issue = makeIssue({ id: 'mc-task-created', identifier: 'X0-101' });
    const fetchMock = stubFetch(issue);
    const client = mockClient();
    vi.mocked(client.mutation).mockResolvedValue({
      updateTask: { id: 'task-uuid-1' },
    });

    const result = await createTaskMulticaIssueHandler(
      {
        id: 'task-uuid-1',
        title: 'Client onboarding',
        bodyV2: 'Set up new client account',
        multicaPriority: 'HIGH',
        status: 'todo',
        dueAt: '2026-07-15',
      },
      client,
    );

    // Verify Multica API was called
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.multica.ai/api/issues?workspace_id=${WORKSPACE_ID}`,
      expect.objectContaining({ method: 'POST' }),
    );

    const [, fetchInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(fetchInit.body as string)).toMatchObject({
      title: 'Client onboarding',
      description: 'Set up new client account',
      priority: 'high',
      status: 'todo',
      project_id: PROJECT_ID,
    });

    // Verify Twenty task was updated with Multica IDs
    expect(client.mutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          id: 'task-uuid-1',
          data: expect.objectContaining({
            multicaIssueId: 'mc-task-created',
            multicaIdentifier: 'X0-101',
          }),
        }),
      }),
    );

    const updateCall = (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.variables.data.lastSyncedFromMulticaAt).toBeDefined();

    expect(result).toEqual({ success: true, issue });
  });

  it('returns the Multica issue for the caller to use', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const issue = makeIssue({ id: 'mc-task-issue', identifier: 'X0-102' });
    stubFetch(issue);
    const client = mockClient();
    vi.mocked(client.mutation).mockResolvedValue({
      updateTask: { id: 'task-uuid-2' },
    });

    const result = await createTaskMulticaIssueHandler(
      { id: 'task-uuid-2', title: 'Simple task' },
      client,
    );

    expect(result).toEqual({ success: true, issue });
  });
});

// ---------------------------------------------------------------------------
// updateTaskMulticaIssueHandler
// ---------------------------------------------------------------------------
describe('updateTaskMulticaIssueHandler', () => {
  it('requires a multicaIssueId', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch();

    const result = await updateTaskMulticaIssueHandler({
      multicaIssueId: '   ',
      title: 'Updated task',
    });

    expect(result).toEqual({
      success: false,
      error: '`multicaIssueId` is required.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips outward update when lastSyncedFromMulticaAt is recent (loop guard)', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch();

    const result = await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      lastSyncedFromMulticaAt: new Date().toISOString(),
      status: 'DONE',
    });

    expect(result).toEqual({
      success: false,
      error: 'Skipped — record was just synced from Multica (loop guard).',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows outward update when lastSyncedFromMulticaAt is stale', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const issue = makeIssue({ status: 'done' });
    const fetchMock = stubFetch(issue);
    const staleDate = new Date(Date.now() - 60_000).toISOString();

    const result = await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      lastSyncedFromMulticaAt: staleDate,
      status: 'DONE',
    });

    expect(result).toEqual({ success: true, issue });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('maps Task TODO to Multica todo and sends partial PUT', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const issue = makeIssue({ status: 'in_progress' });
    const fetchMock = stubFetch(issue);

    const result = await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      status: 'TODO',
    });

    expect(result).toEqual({ success: true, issue });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ status: 'todo' });
  });

  it('maps Task IN_PROGRESS to Multica in_progress', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch(makeIssue({ status: 'in_progress' }));

    await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      status: 'IN_PROGRESS',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      status: 'in_progress',
    });
  });

  it('maps Task DONE to Multica done', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch(makeIssue({ status: 'done' }));

    await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      status: 'DONE',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ status: 'done' });
  });

  it('passes through lowercase Multica-format status values unchanged', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch(makeIssue({ status: 'in_progress' }));

    await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      status: 'in_progress',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      status: 'in_progress',
    });
  });

  it('maps Task priority HIGH to Multica high', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch(makeIssue({ priority: 'high' }));

    await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      multicaPriority: 'HIGH',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ priority: 'high' });
  });

  it('sends only the fields that were provided (partial PUT)', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch(makeIssue());

    await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      title: 'Only title changed',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'Only title changed',
    });
  });

  it('maps Task bodyV2 and dueAt to Multica description and due_date', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    const fetchMock = stubFetch(makeIssue());

    await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      bodyV2: 'Updated task body',
      dueAt: '2026-08-15',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      description: 'Updated task body',
      due_date: '2026-08-15',
    });
  });

  it('handles Multica API error gracefully', async () => {
    process.env.MULTICA_API_KEY = 'pat-task-test';
    stubFetchError(400, 'Bad request');

    const result = await updateTaskMulticaIssueHandler({
      multicaIssueId: 'mc-issue-1',
      status: 'DONE',
    });

    expect(result).toEqual({
      success: false,
      error: 'Multica API returned 400: Bad request',
    });
  });
});

// ---------------------------------------------------------------------------
// taskSyncWebhookHandler
// ---------------------------------------------------------------------------
describe('taskSyncWebhookHandler', () => {
  it('returns received:false when body has no issue', async () => {
    const result = await taskSyncWebhookHandler({
      body: { event: 'issue.updated' },
      headers: {},
    });

    expect(result).toEqual({ received: false });
  });

  it('returns received:false when no task matches the multicaIssueId', async () => {
    const client = mockClient();
    vi.mocked(client.query).mockResolvedValue({ tasks: { edges: [] } });

    const result = await taskSyncWebhookHandler(
      {
        body: {
          event: 'issue.updated',
          issue: { id: 'mc-issue-unknown', title: 'Orphan issue' },
        },
        headers: {},
      },
      client,
    );

    expect(result).toEqual({ received: false });
  });

  it('finds task by multicaIssueId and updates all mapped fields', async () => {
    const client = mockClient();
    vi.mocked(client.query).mockResolvedValue({
      tasks: {
        edges: [
          {
            node: {
              id: 'task-uuid-webhook',
              multicaIssueId: 'mc-issue-1',
            },
          },
        ],
      },
    });
    vi.mocked(client.mutation).mockResolvedValue({
      updateTask: { id: 'task-uuid-webhook' },
    });

    const result = await taskSyncWebhookHandler(
      {
        body: {
          event: 'issue.updated',
          issue: {
            id: 'mc-issue-1',
            title: 'Updated from Multica',
            description: 'New description from Multica',
            status: 'in_progress',
            priority: 'high',
            identifier: 'X0-100',
            due_date: '2026-07-15',
            updated_at: '2026-07-01T12:00:00Z',
          },
        },
        headers: {},
      },
      client,
    );

    expect(result).toEqual({
      received: true,
      mapped: {
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        action: 'updated',
      },
    });

    // Verify the find query was for the right Multica issue ID
    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          filter: { multicaIssueId: { eq: 'mc-issue-1' } },
        }),
      }),
    );

    // Verify the update mutation set loop guard and mapped fields
    const updateCall = (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.variables.id).toBe('task-uuid-webhook');
    expect(updateCall.variables.data).toMatchObject({
      title: 'Updated from Multica',
      bodyV2: 'New description from Multica',
      status: 'IN_PROGRESS',
      multicaPriority: 'HIGH',
      multicaIdentifier: 'X0-100',
    });
    expect(updateCall.variables.data.lastSyncedFromMulticaAt).toBeDefined();
  });

  it('maps Multica todo/backlog status to Twenty TODO', async () => {
    const client = mockClient();
    vi.mocked(client.query).mockResolvedValue({
      tasks: {
        edges: [
          {
            node: { id: 'task-uuid-2', multicaIssueId: 'mc-issue-2' },
          },
        ],
      },
    });
    vi.mocked(client.mutation).mockResolvedValue({
      updateTask: { id: 'task-uuid-2' },
    });

    await taskSyncWebhookHandler(
      {
        body: {
          event: 'issue.updated',
          issue: { id: 'mc-issue-2', status: 'todo' },
        },
        headers: {},
      },
      client,
    );

    const updateCall = (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.variables.data.status).toBe('TODO');
  });

  it('maps Multica done status to Twenty DONE', async () => {
    const client = mockClient();
    vi.mocked(client.query).mockResolvedValue({
      tasks: {
        edges: [
          {
            node: { id: 'task-uuid-3', multicaIssueId: 'mc-issue-3' },
          },
        ],
      },
    });
    vi.mocked(client.mutation).mockResolvedValue({
      updateTask: { id: 'task-uuid-3' },
    });

    await taskSyncWebhookHandler(
      {
        body: {
          event: 'issue.updated',
          issue: { id: 'mc-issue-3', status: 'done' },
        },
        headers: {},
      },
      client,
    );

    const updateCall = (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.variables.data.status).toBe('DONE');
  });

  it('maps Multica cancelled to no status change (no direct match)', async () => {
    const client = mockClient();
    vi.mocked(client.query).mockResolvedValue({
      tasks: {
        edges: [
          {
            node: { id: 'task-uuid-4', multicaIssueId: 'mc-issue-4' },
          },
        ],
      },
    });
    vi.mocked(client.mutation).mockResolvedValue({
      updateTask: { id: 'task-uuid-4' },
    });

    await taskSyncWebhookHandler(
      {
        body: {
          event: 'issue.updated',
          issue: { id: 'mc-issue-4', status: 'cancelled' },
        },
        headers: {},
      },
      client,
    );

    const updateCall = (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.variables.data.status).not.toBeDefined();
  });

  it('maps Multica due_date to task dueAt field', async () => {
    const client = mockClient();
    vi.mocked(client.query).mockResolvedValue({
      tasks: {
        edges: [
          {
            node: { id: 'task-uuid-5', multicaIssueId: 'mc-issue-5' },
          },
        ],
      },
    });
    vi.mocked(client.mutation).mockResolvedValue({
      updateTask: { id: 'task-uuid-5' },
    });

    await taskSyncWebhookHandler(
      {
        body: {
          event: 'issue.updated',
          issue: { id: 'mc-issue-5', due_date: '2026-08-01' },
        },
        headers: {},
      },
      client,
    );

    const updateCall = (client.mutation as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(updateCall.variables.data.dueAt).toBe('2026-08-01');
  });
});
