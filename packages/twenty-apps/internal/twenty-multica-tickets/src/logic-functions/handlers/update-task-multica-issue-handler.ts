import type { MulticaIssue } from 'src/logic-functions/types/multica.types';

const WORKSPACE_ID = 'd11337e4-0c4e-43b8-8fc8-8216c70f1427';

export interface UpdateTaskIssueInput {
  multicaIssueId: string;
  title?: string;
  bodyV2?: string;
  multicaPriority?: string;
  status?: string;
  dueAt?: string;
  /** Set by database-event triggers to detect webhook-initiated updates. */
  lastSyncedFromMulticaAt?: string;
}

export type UpdateTaskIssueResult =
  | { success: true; issue: MulticaIssue }
  | { success: false; error: string };

/**
 * If the task's lastSyncedFromMulticaAt was set within this window (ms),
 * the update was initiated by the inbound webhook — do not push outward.
 */
const LOOP_GUARD_WINDOW_MS = 10_000;

/** Task status (uppercase) → Multica status (lowercase). */
const TASK_STATUS_TO_MULTICA: Record<string, string> = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
};

/** Task priority (uppercase) → Multica priority (lowercase). */
const TASK_PRIORITY_TO_MULTICA: Record<string, string> = {
  URGENT: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const normalizeOutbound = (
  input: UpdateTaskIssueInput,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};

  if (input.title !== undefined) {
    body.title = input.title;
  }

  if (input.bodyV2 !== undefined) {
    body.description = input.bodyV2;
  }

  if (input.dueAt !== undefined) {
    body.due_date = input.dueAt;
  }

  if (input.status !== undefined) {
    if (TASK_STATUS_TO_MULTICA[input.status]) {
      body.status = TASK_STATUS_TO_MULTICA[input.status];
    } else if (/^[a-z_]/.test(input.status)) {
      // Already Multica-format (lowercase), pass through
      body.status = input.status;
    } else {
      body.status = input.status.toLowerCase();
    }
  }

  if (input.multicaPriority !== undefined) {
    if (TASK_PRIORITY_TO_MULTICA[input.multicaPriority]) {
      body.priority = TASK_PRIORITY_TO_MULTICA[input.multicaPriority];
    } else if (/^[a-z_]/.test(input.multicaPriority)) {
      body.priority = input.multicaPriority;
    } else {
      body.priority = input.multicaPriority.toLowerCase();
    }
  }

  return body;
};

export const updateTaskMulticaIssueHandler = async (
  input: UpdateTaskIssueInput,
): Promise<UpdateTaskIssueResult> => {
  const apiKey = process.env.MULTICA_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'Missing MULTICA_API_KEY environment variable.',
    };
  }

  if (
    !input.multicaIssueId ||
    input.multicaIssueId.trim().length === 0
  ) {
    return {
      success: false,
      error: '`multicaIssueId` is required.',
    };
  }

  // Loop guard: if this update was triggered by the Multica webhook receiver,
  // lastSyncedFromMulticaAt will be fresh — skip the outward push.
  if (input.lastSyncedFromMulticaAt) {
    const syncedAt = new Date(input.lastSyncedFromMulticaAt).getTime();
    const now = Date.now();
    if (now - syncedAt < LOOP_GUARD_WINDOW_MS) {
      return {
        success: false,
        error: 'Skipped — record was just synced from Multica (loop guard).',
      };
    }
  }

  try {
    const body = normalizeOutbound(input);

    const response = await fetch(
      `https://api.multica.ai/api/issues/${encodeURIComponent(input.multicaIssueId)}?workspace_id=${WORKSPACE_ID}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
    return { success: true, issue };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown network error';
    return { success: false, error: message };
  }
};
