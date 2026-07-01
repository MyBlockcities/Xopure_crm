import {
  defineField,
  FieldType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import { TASK_MULTICA_PRIORITY_FIELD_ID } from 'src/constants/universal-identifiers';

export default defineField({
  universalIdentifier: TASK_MULTICA_PRIORITY_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.task.universalIdentifier,
  type: FieldType.SELECT,
  name: 'multicaPriority',
  label: 'Multica Priority',
  icon: 'IconFlag',
  isNullable: true,
  defaultValue: null,
  options: [
    {
      id: '17e5a6b4-65c0-4cb4-8a3a-1c0f6e50c6d1',
      value: 'URGENT',
      label: 'Urgent',
      color: 'red',
      position: 0,
    },
    {
      id: '2f0f4b10-5e0d-42af-8b63-70f91fa147aa',
      value: 'HIGH',
      label: 'High',
      color: 'orange',
      position: 1,
    },
    {
      id: 'c3f6af16-9f68-4f2d-bc85-52f8873a6d44',
      value: 'MEDIUM',
      label: 'Medium',
      color: 'yellow',
      position: 2,
    },
    {
      id: 'be8e351b-f43c-46e8-b3df-f53d3f358ec5',
      value: 'LOW',
      label: 'Low',
      color: 'green',
      position: 3,
    },
  ],
  description:
    'Multica issue priority mirrored onto the standard task object.',
});
