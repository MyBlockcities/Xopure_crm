import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { TASK_MULTICA_IDENTIFIER_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: TASK_MULTICA_IDENTIFIER_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.TEXT,
  name: 'multicaIdentifier',
  label: 'Multica Identifier',
  icon: 'IconHash',
  isNullable: true,
  defaultValue: null,
  description:
    'Human-readable Multica identifier (e.g. X0-100). Updated by the inbound webhook.',
});
