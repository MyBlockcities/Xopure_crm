import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { TASK_LAST_SYNCED_FROM_MULTICA_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: TASK_LAST_SYNCED_FROM_MULTICA_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.DATE_TIME,
  name: 'lastSyncedFromMulticaAt',
  label: 'Last Synced from Multica At',
  icon: 'IconRefresh',
  isNullable: true,
  defaultValue: null,
  description:
    'Timestamp of the last inbound sync from Multica. Used by the loop guard to prevent update cycles.',
});
