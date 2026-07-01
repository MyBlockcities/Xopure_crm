import { CoreApiClient } from 'twenty-client-sdk/core';
import type { MulticaSyncClient } from 'src/logic-functions/types/multica.types';

export interface TaskSyncResult {
  received: boolean;
  mapped?: {
    status?: string;
    priority?: string;
    action: string;
  };
}

interface WebhookPayload {
  event: string;
  issue: {
    id: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    identifier?: string;
    updated_at?: string;
    labels?: string[];
    due_date?: string;
    start_date?: string;
    metadata?: Record<string, unknown>;
  };
}

interface TaskSyncWebhookEvent {
  body?: unknown;
  headers?: Record<string, string | undefined>;
}

// Multica status → Twenty Task status values
// Task uses TODO/IN_PROGRESS/DONE — no backlog/cancelled equivalents
const STATUS_MAP: Record<string, string> = {
  backlog: 'TODO',
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  in_review: 'IN_PROGRESS',
  done: 'DONE',
};

// Multica priority → Twenty Task priority (uppercase)
const PRIORITY_MAP: Record<string, string> = {
  urgent: 'URGENT',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

const TASK_OBJECT_API_NAME = 'task';
const TASK_OBJECT_API_NAME_PLURAL = 'tasks';

export const taskSyncWebhookHandler = async (
  event: TaskSyncWebhookEvent,
  client?: MulticaSyncClient,
): Promise<TaskSyncResult> => {
  const secret = process.env.MULTICA_WEBHOOK_SECRET;
  const signature = event.headers?.['x-multica-signature'];

  if (secret && !signature) {
    console.warn('task-sync-webhook: missing x-multica-signature header');
    return { received: false };
  }

  const body = event.body as WebhookPayload | null;

  if (!body || !body.issue) {
    return { received: false };
  }

  const issue = body.issue;
  const multicaIssueId = issue.id;

  if (!multicaIssueId) {
    return { received: false };
  }

  // Map Multica fields to Twenty Task fields
  const mappedStatus = issue.status
    ? STATUS_MAP[issue.status]
    : undefined;
  const mappedPriority = issue.priority
    ? PRIORITY_MAP[issue.priority]
    : undefined;

  try {
    const apiClient = client ?? new CoreApiClient();

    // Step 1: Find the Twenty task by multicaIssueId
    const findQuery = `
      query FindTaskByMulticaIssueId($filter: ${TASK_OBJECT_API_NAME}FilterInput!) {
        ${TASK_OBJECT_API_NAME_PLURAL}(filter: $filter, first: 1) {
          edges {
            node {
              id
              multicaIssueId
              lastSyncedFromMulticaAt
            }
          }
        }
      }
    `;

    const findResult = await apiClient.query({
      query: findQuery,
      variables: {
        filter: {
          multicaIssueId: { eq: multicaIssueId },
        },
      },
    });

    const tasks =
      (findResult as Record<string, unknown>)?.[
        TASK_OBJECT_API_NAME_PLURAL
      ] as
        | {
            edges?: Array<{
              node?: { id: string };
            }>;
          }
        | undefined;

    const task = tasks?.edges?.[0]?.node;

    if (!task?.id) {
      console.warn(
        `task-sync-webhook: no task found for Multica issue ${issue.identifier ?? multicaIssueId}`,
      );
      return { received: false };
    }

    // Step 2: Build update fields from mapped Multica data
    const updateFields: Record<string, unknown> = {
      lastSyncedFromMulticaAt: new Date().toISOString(),
    };

    if (issue.title) {
      updateFields.title = issue.title;
    }
    if (issue.description !== undefined) {
      updateFields.bodyV2 = issue.description;
    }
    if (mappedStatus) {
      updateFields.status = mappedStatus;
    }
    if (mappedPriority) {
      updateFields.multicaPriority = mappedPriority;
    }
    if (issue.identifier) {
      updateFields.multicaIdentifier = issue.identifier;
    }
    if (issue.due_date) {
      // Task field is dueAt, not dueDate
      updateFields.dueAt = issue.due_date;
    }

    // Step 3: Update the task with loop guard set
    const updateMutation = `
      mutation UpdateTaskWithMulticaData($id: ID!, $data: ${TASK_OBJECT_API_NAME}UpdateInput!) {
        update${TASK_OBJECT_API_NAME.charAt(0).toUpperCase() + TASK_OBJECT_API_NAME.slice(1)}(id: $id, data: $data) {
          id
        }
      }
    `;

    await apiClient.mutation({
      query: updateMutation,
      variables: {
        id: task.id,
        data: updateFields,
      },
    });

    return {
      received: true,
      mapped: {
        status: mappedStatus,
        priority: mappedPriority,
        action: 'updated',
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`task-sync-webhook: sync failed: ${message}`);
    return { received: false };
  }
};
