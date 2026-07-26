import { defineField, FieldType, OnDeleteAction, RelationType } from 'twenty-sdk/define';
import { XOPURE_AMBASSADOR_OBJECT_ID } from '../objects/xopure-ambassador.object';
import {
  MENTEES_ON_AMBASSADOR_FIELD_ID,
  SPONSOR_ON_AMBASSADOR_FIELD_ID,
} from './ambassador-mentees-on-ambassador.field';

export default defineField({
  universalIdentifier: SPONSOR_ON_AMBASSADOR_FIELD_ID,
  objectUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
  type: FieldType.RELATION,
  name: 'sponsor',
  label: 'Sponsor',
  icon: 'IconCrown',
  description:
    'Upline ambassador. Mirrors Supabase affiliates.parent_id. NULL means genealogy root — present as "review", not "error".',
  relationTargetObjectMetadataUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: MENTEES_ON_AMBASSADOR_FIELD_ID,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'sponsorId',
  },
});
