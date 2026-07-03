import { defineRole } from 'twenty-sdk/define';

import { DEFAULT_ROLE_ID } from 'src/constants/universal-identifiers';

export default defineRole({
  universalIdentifier: DEFAULT_ROLE_ID,
  label: 'XO Pure Logging viewer',
  description: 'Allows users and app API keys to view XO Pure observability panels and call logging proxy functions.',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: false,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToAgents: false,
  canBeAssignedToUsers: true,
  canBeAssignedToApiKeys: true,
});
