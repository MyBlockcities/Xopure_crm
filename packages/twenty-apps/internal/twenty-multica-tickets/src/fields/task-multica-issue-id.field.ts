import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { TASK_MULTICA_ISSUE_ID_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: TASK_MULTICA_ISSUE_ID_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.TEXT,
  name: 'multicaIssueId',
  label: 'Multica Issue ID',
  icon: 'IconDatabase',
  isUnique: true,
  isNullable: true,
  defaultValue: null,
  description:
    'The Multica issue UUID linked to this task. Set by the task sync handler on creation.',
});
