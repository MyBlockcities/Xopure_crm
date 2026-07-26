import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';
import { XOPURE_AMBASSADOR_OBJECT_ID } from '../objects/xopure-ambassador.object';

export const AMBASSADOR_PROFILES_ON_PERSON_FIELD_ID =
  'cd554ab0-633c-4bae-8f93-d9d7841f756a';
export const PERSON_ON_AMBASSADOR_FIELD_ID =
  'f07a215f-7840-4e7b-8f50-0b04eb6dbf50';

export default defineField({
  universalIdentifier: AMBASSADOR_PROFILES_ON_PERSON_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'xopureAmbassadorProfiles',
  label: 'XO Pure ambassador profiles',
  icon: 'IconRosetteDiscountCheck',
  description:
    'Person is the contact identity; XO Pure Ambassador is the business profile.',
  relationTargetObjectMetadataUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
  relationTargetFieldMetadataUniversalIdentifier: PERSON_ON_AMBASSADOR_FIELD_ID,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
