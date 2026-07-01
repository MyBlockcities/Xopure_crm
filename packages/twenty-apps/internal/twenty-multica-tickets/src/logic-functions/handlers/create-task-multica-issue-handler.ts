import { CoreApiClient } from 'twenty-client-sdk/core';
import type { MulticaIssue } from 'src/logic-functions/types/multica.types';
import type { MulticaSyncClient } from 'src/logic-functions/types/multica.types';

const WORKSPACE_ID = 'd11337e4-0c4e-43b8-8fc8-8216c70f1427';
const PROJECT_ID = 'fb2e3c0e-27e0-47ac-b86d-3d2e18832fd6';

export interface CreateTaskIssueInput {
  /** The Twenty task record `id` field. Named `id` to match the DB event record shape. */
  id: string;
  title: string;
  bodyV2?: string;
  multicaPriority?: string;
  status?: string;
  dueAt?: string;
}

export type CreateTaskIssueResult =
  | { success: true; issue: MulticaIssue }
  | { success: false; error: string };

export const createTaskMulticaIssueHandler = async (
  input: CreateTaskIssueInput,
  client?: MulticaSyncClient,
): Promise<CreateTaskIssueResult> => {
  const apiKey = process.env.MULTICA_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'Missing MULTICA_API_KEY environment variable.',
    };
  }

  if (!input.title || input.title.trim().length === 0) {
    return {
      success: false,
      error: '`title` is required.',
    };
  }

  try {
    // Step 1: Create the Multica issue
    const response = await fetch(
      `https://api.multica.ai/api/issues?workspace_id=${WORKSPACE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: input.title,
          description: input.bodyV2,
          priority: input.multicaPriority?.toLowerCase(),
          status: input.status,
          project_id: PROJECT_ID,
          due_date: input.dueAt,
          metadata: {
            source: 'twenty-multica-tickets',
            app_version: '0.1.0',
            created_via: 'task-sync',
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Multica API returned ${response.status}: ${errorBody}`,
      };
    }

    const issue = (await response.json()) as MulticaIssue;

    // Step 2: Update the Twenty task record with Multica IDs and loop guard
    const now = new Date().toISOString();

    const updateFields: Record<string, unknown> = {
      multicaIssueId: issue.id,
      multicaIdentifier: issue.identifier,
      lastSyncedFromMulticaAt: now,
    };

    const apiClient = client ?? new CoreApiClient();
    await apiClient.mutation({
      query: `
        mutation UpdateTaskWithMulticaIds($id: ID!, $data: TaskUpdateInput!) {
          updateTask(id: $id, data: $data) {
            id
          }
        }
      `,
      variables: {
        id: input.id,
        data: updateFields,
      },
    });

    return { success: true, issue };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown network error';
    return { success: false, error: message };
  }
};
