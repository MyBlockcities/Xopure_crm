import { defineField, FieldType, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

export const PERSON_XOPURE_AMBASSADOR_LEVEL_FIELD_ID =
  'a36d58d3-37f1-4129-92e1-d6d947d8b025';

export default defineField({
  universalIdentifier: PERSON_XOPURE_AMBASSADOR_LEVEL_FIELD_ID,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.SELECT,
  name: 'xopureAmbassadorLevel',
  label: 'XO Pure ambassador rank',
  description:
    'Fast segmentation field mirroring the ambassador paid-as rank on person records. Values are the PERMANENT internal comp-plan keys; labels are the spec display names (COMP_PLAN_LAW §1.5).',
  icon: 'IconAward',
  isNullable: true,
  defaultValue: null,
  options: [
    { id: '7060a9e6-bc8d-43f1-bbc0-12afef2b0d88', value: 'CUSTOMER', label: 'Customer', position: 0, color: 'gray' },
    { id: '17e9df54-29b2-4a78-b8ca-955a3edbbd2d', value: 'STARTER', label: 'Ambassador', position: 1, color: 'blue' },
    { id: 'a9ea0737-aed6-47b2-8965-a167426c590d', value: 'BUILDER', label: 'Partner', position: 2, color: 'turquoise' },
    { id: 'f4a8da4e-e268-4519-aa3d-b1b389977bbf', value: 'INFLUENCER', label: 'Influencer', position: 3, color: 'green' },
    { id: '5d33e13e-1087-49e6-ae0a-e1af0eb15aaf', value: 'PROMOTER', label: 'Leader', position: 4, color: 'yellow' },
    { id: '6d308ec4-747f-4c14-af6a-5900617823a5', value: 'LEADER', label: 'Executive', position: 5, color: 'orange' },
    { id: '386ad8eb-2d48-443d-8f23-f1fb029d1c37', value: 'DIRECTOR', label: 'Director', position: 6, color: 'pink' },
    { id: 'dcfd0614-48ce-4416-a688-3070f0fbffff', value: 'ICON', label: 'Visionary', position: 7, color: 'purple' },
  ],
});
