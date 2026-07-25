import { defineRole } from 'twenty-sdk/define';
import { DEFAULT_ROLE_ID } from '../constants/universal-identifiers';

export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = DEFAULT_ROLE_ID;

export default defineRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  label: 'XO Pure Logging observability role',
  description: 'Default role for XO Pure Logging Grafana, Loki, and Tempo observability functions.',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToAgents: true,
  canBeAssignedToUsers: true,
  canBeAssignedToApiKeys: true,
});
