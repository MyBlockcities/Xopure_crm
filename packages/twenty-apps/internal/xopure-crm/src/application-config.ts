import { defineApplication } from 'twenty-sdk/define';
import { DEFAULT_ROLE_UNIVERSAL_IDENTIFIER } from 'src/roles/default-role';

export const APPLICATION_UNIVERSAL_IDENTIFIER =
  'ce8ec254-f99a-4e12-b23c-8ea97880a30b';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'XO Pure CRM',
  description:
    'Customer, ambassador, orders, commissions, prospects, sequences, and enrichment operations for XO Pure.',
  defaultRoleUniversalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER,
  applicationVariables: {
    XOPURE_SYNC_WEBHOOK_SECRET: {
      universalIdentifier: 'c57b0aad-9743-4b9e-8bc2-172178c018b3',
      description: 'Shared secret expected on Supabase webhook calls into Twenty.',
      value: '',
      isSecret: true,
    },
    XOPURE_ENRICHMENT_PROVIDER: {
      universalIdentifier: 'b51f2252-1291-43e5-9c7b-a065555bb34b',
      description: 'Contact enrichment provider identifier used by enrichment jobs.',
      value: 'manual',
      isSecret: false,
    },
    XOPURE_SUPABASE_URL: {
      universalIdentifier: '6e37d170-d37b-4ac9-bd8f-a924d9038c7b',
      description:
        'Supabase project URL used by read-only realtime dashboard cards.',
      value: '',
      isSecret: false,
    },
    XOPURE_SUPABASE_ANON_KEY: {
      universalIdentifier: 'f4fd3f8d-e981-4c0a-b2fc-fe603c5fed36',
      description:
        'RLS-scoped anon key used by read-only realtime dashboard cards. Never use a service-role key.',
      value: '',
      isSecret: false,
    },
    XOPURE_LIVE_METRIC_TABLE: {
      universalIdentifier: '2afdd090-eb21-4440-af84-3b3102782aaf',
      description:
        'Allowlisted Supabase table counted by the live metric card: orders, affiliates, or customers.',
      value: 'orders',
      isSecret: false,
    },
  },
});
