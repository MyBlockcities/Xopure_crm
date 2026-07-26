import { defineField, FieldType, RelationType } from 'twenty-sdk/define';
import { XOPURE_AMBASSADOR_OBJECT_ID } from '../objects/xopure-ambassador.object';

export const MENTEES_ON_AMBASSADOR_FIELD_ID = 'f3c99333-6a54-420d-818e-d2a55f509b58';
export const SPONSOR_ON_AMBASSADOR_FIELD_ID = 'c3c3eab2-bf44-4ba6-8562-84b282edeaa6';

export default defineField({
  universalIdentifier: MENTEES_ON_AMBASSADOR_FIELD_ID,
  objectUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'mentees',
  label: 'Mentees',
  icon: 'IconUsersGroup',
  description:
    'Direct downline. Mirrors Supabase affiliates.parent_id — the child side of the genealogy tree.',
  relationTargetObjectMetadataUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: SPONSOR_ON_AMBASSADOR_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
