import { defineLogicFunction } from 'twenty-sdk/define';

import { UPDATE_TASK_MULTICA_ISSUE_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { updateTaskMulticaIssueHandler } from 'src/logic-functions/handlers/update-task-multica-issue-handler';

export default defineLogicFunction({
  universalIdentifier: UPDATE_TASK_MULTICA_ISSUE_FUNCTION_ID,
  name: 'update-task-multica-issue',
  description:
    'Update an existing Multica issue when a Twenty task status, priority, title, body, or due date changes. Includes loop guard to prevent webhook re-trigger.',
  timeoutSeconds: 30,
  handler: updateTaskMulticaIssueHandler,
  databaseEventTriggerSettings: {
    eventName: 'task.updated',
    updatedFields: ['status', 'multicaPriority', 'title', 'bodyV2', 'dueAt'],
  },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        multicaIssueId: {
          type: 'string',
          description: 'Multica issue UUID.',
        },
        title: {
          type: 'string',
          description: 'Task title.',
        },
        bodyV2: {
          type: 'string',
          description: 'Task rich-text body.',
        },
        dueAt: {
          type: 'string',
          description: 'Task due date as ISO 8601 string.',
        },
        status: {
          type: 'string',
          enum: [
            'backlog',
            'todo',
            'in_progress',
            'in_review',
            'done',
            'cancelled',
          ],
        },
        multicaPriority: {
          type: 'string',
          enum: [
            'URGENT',
            'HIGH',
            'MEDIUM',
            'LOW',
            'urgent',
            'high',
            'medium',
            'low',
          ],
        },
      },
      required: ['multicaIssueId'],
    },
  },
});
