import { defineLogicFunction } from 'twenty-sdk/define';

import { CREATE_TASK_MULTICA_ISSUE_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { createTaskMulticaIssueHandler } from 'src/logic-functions/handlers/create-task-multica-issue-handler';

export default defineLogicFunction({
  universalIdentifier: CREATE_TASK_MULTICA_ISSUE_FUNCTION_ID,
  name: 'create-task-multica-issue',
  description:
    'Create a new issue in the Multica Support project when a Twenty task is created, then update the task with Multica IDs.',
  timeoutSeconds: 30,
  handler: createTaskMulticaIssueHandler,
  databaseEventTriggerSettings: {
    eventName: 'task.created',
    updatedFields: [],
  },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Twenty task record ID.',
        },
        title: {
          type: 'string',
          description: 'Task title.',
        },
        bodyV2: {
          type: 'string',
          description: 'Task rich-text body.',
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
          description: 'Multica issue priority stored on the Task.',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'],
          description: 'Initial issue status.',
        },
        dueAt: {
          type: 'string',
          description: 'Due date as ISO 8601 string.',
        },
      },
      required: ['title'],
    },
  },
  workflowActionTriggerSettings: {
    label: 'Create Multica Issue from Task',
    inputSchema: [
      {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          bodyV2: { type: 'string' },
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
          status: {
            type: 'string',
            enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'],
          },
          dueAt: { type: 'string' },
        },
      },
    ],
    outputSchema: [
      {
        type: 'object',
        properties: {
          identifier: { type: 'string' },
          url: { type: 'string' },
        },
      },
    ],
  },
});
