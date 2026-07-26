import { defineObject, FieldType } from 'twenty-sdk/define';

export const XOPURE_AMBASSADOR_OBJECT_ID = 'edcc4b8c-e7eb-4d71-9c09-c2a46bb7b334';
export const XOPURE_AMBASSADOR_NAME_FIELD_ID = '2e504ddb-eee1-4ce2-af0b-8dc9b0df3e04';
export const XOPURE_AMBASSADOR_PAID_AS_RANK_FIELD_ID =
  '1e0f5ff7-5e98-414c-9a2a-09260d916bbc';

/** @deprecated Renamed to XOPURE_AMBASSADOR_PAID_AS_RANK_FIELD_ID. Same UUID, kept for import compatibility. */
export const XOPURE_AMBASSADOR_LEVEL_FIELD_ID =
  XOPURE_AMBASSADOR_PAID_AS_RANK_FIELD_ID;
export const XOPURE_AMBASSADOR_STATUS_FIELD_ID = '88af418d-b7af-419e-a546-42fd1a92fc08';
export const XOPURE_AMBASSADOR_ATTRIBUTED_REVENUE_FIELD_ID =
  '6cdfdeac-23c4-4bb1-b61c-e2ed179b25ba';
export const XOPURE_AMBASSADOR_TOTAL_COMMISSION_EARNED_FIELD_ID =
  'a38232d0-4679-46f5-950a-6d6000ed7221';

export default defineObject({
  universalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
  nameSingular: 'xopureAmbassador',
  namePlural: 'xopureAmbassadors',
  labelSingular: 'XO Pure Ambassador',
  labelPlural: 'XO Pure Ambassadors',
  description:
    'Ambassador lifecycle, comp-plan rank, genealogy (sponsor/mentees), codes, attribution, and payout context.',
  icon: 'IconRosetteDiscountCheck',
  labelIdentifierFieldMetadataUniversalIdentifier: XOPURE_AMBASSADOR_NAME_FIELD_ID,
  fields: [
    { universalIdentifier: XOPURE_AMBASSADOR_NAME_FIELD_ID, type: FieldType.TEXT, name: 'name', label: 'Name', icon: 'IconUserStar' },
    { universalIdentifier: 'f6f2230e-f5a8-4472-bd05-3f7bfc1f928b', type: FieldType.TEXT, name: 'supabaseAmbassadorId', label: 'Supabase ambassador ID', icon: 'IconDatabase' },
    {
      universalIdentifier: XOPURE_AMBASSADOR_PAID_AS_RANK_FIELD_ID,
      type: FieldType.SELECT,
      name: 'paidAsRank',
      label: 'Paid-as rank',
      icon: 'IconAward',
      description:
        'Comp-plan rank this ambassador is paid at. Mirrors Supabase affiliates.paid_as_rank. Values are the PERMANENT internal keys; labels are the spec display names (COMP_PLAN_LAW §1.5). Never surface the raw value.',
      defaultValue: "'STARTER'",
      options: [
        { id: 'f504a596-b98a-4418-9396-3c76603c2c28', value: 'CUSTOMER', label: 'Customer', position: 0, color: 'gray' },
        { id: '01a2f838-bef1-4b6d-9d31-1a9a3bb46085', value: 'STARTER', label: 'Ambassador', position: 1, color: 'blue' },
        { id: '6a52b692-5b95-4cc8-8e47-1e9aa450111d', value: 'BUILDER', label: 'Partner', position: 2, color: 'turquoise' },
        { id: 'dcec77f6-afed-4c44-a5d8-9bda1bfffbb3', value: 'INFLUENCER', label: 'Influencer', position: 3, color: 'green' },
        { id: 'fecb984b-7765-404c-abf9-09b24b121f11', value: 'PROMOTER', label: 'Leader', position: 4, color: 'yellow' },
        { id: '295bcf50-e367-4300-b65a-c16c6ef0f5b1', value: 'LEADER', label: 'Executive', position: 5, color: 'orange' },
        { id: '9a43cd89-2e7a-497b-8081-bf9cdeb3f5d8', value: 'DIRECTOR', label: 'Director', position: 6, color: 'pink' },
        { id: '1edcaa06-7b2c-4cce-92e9-e05ef6e9d372', value: 'ICON', label: 'Visionary', position: 7, color: 'purple' },
      ],
    },
    {
      universalIdentifier: XOPURE_AMBASSADOR_STATUS_FIELD_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgressCheck',
      defaultValue: "'APPLIED'",
      options: [
        { id: '5a034214-9ef6-402d-951e-b6d5536a393d', value: 'APPLIED', label: 'Applied', position: 0, color: 'yellow' },
        { id: 'fe69a60c-311f-4f89-82f4-54a11d839b84', value: 'APPROVED', label: 'Approved', position: 1, color: 'green' },
        { id: '507d047b-33d0-4bff-87e0-4795286365ee', value: 'ACTIVE', label: 'Active', position: 2, color: 'blue' },
        { id: '7f73ed3d-9ab6-41b7-b575-3c89847a804a', value: 'PAUSED', label: 'Paused', position: 3, color: 'orange' },
        { id: '925ad08a-cbc5-48bb-8ac7-faab1fc11de2', value: 'REJECTED', label: 'Rejected', position: 4, color: 'red' },
      ],
    },
    { universalIdentifier: 'e6772271-9b15-484e-8f74-8a1566b4ff47', type: FieldType.TEXT, name: 'referralCode', label: 'Referral code', icon: 'IconTicket' },
    { universalIdentifier: '1bdfadb7-f157-4c2f-9b39-b735c1d71b9a', type: FieldType.NUMBER, name: 'commissionRate', label: 'Commission rate %', icon: 'IconPercentage', defaultValue: 0 },
    { universalIdentifier: XOPURE_AMBASSADOR_ATTRIBUTED_REVENUE_FIELD_ID, type: FieldType.NUMBER, name: 'attributedRevenue', label: 'Attributed revenue', icon: 'IconCurrencyDollar', defaultValue: 0 },
    { universalIdentifier: XOPURE_AMBASSADOR_TOTAL_COMMISSION_EARNED_FIELD_ID, type: FieldType.NUMBER, name: 'totalCommissionEarned', label: 'Commission earned', icon: 'IconCash', defaultValue: 0 },
    { universalIdentifier: '0de23b2b-a89b-4180-96e5-5c70cb6c6c5b', type: FieldType.TEXT, name: 'researchSummary', label: 'Research summary', icon: 'IconNotes' },
  ],
});
