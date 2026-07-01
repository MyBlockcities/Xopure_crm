import { defineLogicFunction } from 'twenty-sdk/define';

import { TASK_SYNC_WEBHOOK_FUNCTION_ID } from 'src/constants/universal-identifiers';
import { taskSyncWebhookHandler } from 'src/logic-functions/handlers/task-sync-webhook-handler';

export default defineLogicFunction({
  universalIdentifier: TASK_SYNC_WEBHOOK_FUNCTION_ID,
  name: 'task-sync-webhook',
  description:
    'Receive issue change events from Multica and update the corresponding Twenty task. Bidirectional sync with loop guard.',
  timeoutSeconds: 30,
  handler: taskSyncWebhookHandler,
  httpRouteTriggerSettings: {
    path: '/multica/task-sync',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['x-multica-signature', 'content-type'],
  },
});
