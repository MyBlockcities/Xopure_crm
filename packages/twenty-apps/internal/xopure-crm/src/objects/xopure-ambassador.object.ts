import { defineObject, FieldType } from 'twenty-sdk/define';

export const XOPURE_AMBASSADOR_OBJECT_ID = 'edcc4b8c-e7eb-4d71-9c09-c2a46bb7b334';
export const XOPURE_AMBASSADOR_NAME_FIELD_ID = '2e504ddb-eee1-4ce2-af0b-8dc9b0df3e04';
export const XOPURE_AMBASSADOR_PAID_AS_RANK_FIELD_ID =
  '1e0f5ff7-5e98-414c-9a2a-09260d916bbc';

/** @deprecated Renamed to XOPURE_AMBASSADOR_PAID_AS_RANK_FIELD_ID. Same UUID, kept for import compatibility. */
export const XOPURE_AMBASSADOR_LEVEL_FIELD_ID =
  XOPURE_AMBASSADOR_PAID_AS_RANK_FIELD_ID;
export const XOPURE_AMBASSADOR_CAREER_RANK_FIELD_ID =
  '9c8ca49d-e5ec-4b16-b9d7-eebba3422a40';
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
    {
      universalIdentifier: XOPURE_AMBASSADOR_CAREER_RANK_FIELD_ID,
      type: FieldType.SELECT,
      name: 'careerRank',
      label: 'Career rank',
      icon: 'IconTrophy',
      description:
        'Highest rank ever achieved. Mirrors Supabase affiliates.career_rank. Rank is never retro-revoked (COMP_PLAN_LAW §1.6), so this only ever moves up.',
      defaultValue: "'STARTER'",
      options: [
        { id: 'c68bf210-179d-4a18-a820-66c45b2a55fb', value: 'CUSTOMER', label: 'Customer', position: 0, color: 'gray' },
        { id: '825b8c65-099e-47a2-bbb1-e8b493129ed9', value: 'STARTER', label: 'Ambassador', position: 1, color: 'blue' },
        { id: '06159b5b-eed6-4d7d-bf5e-e3ad8f44f469', value: 'BUILDER', label: 'Partner', position: 2, color: 'turquoise' },
        { id: '2eed7925-4175-448f-ac9d-492c3e9fe400', value: 'INFLUENCER', label: 'Influencer', position: 3, color: 'green' },
        { id: 'a7d53e2e-a3a2-4351-a45f-2b0aa536ec61', value: 'PROMOTER', label: 'Leader', position: 4, color: 'yellow' },
        { id: 'e88d121e-94c9-4b84-9752-329aa2f989c0', value: 'LEADER', label: 'Executive', position: 5, color: 'orange' },
        { id: '33c61a7c-3e6d-4b62-b9a3-6cb50a294e5b', value: 'DIRECTOR', label: 'Director', position: 6, color: 'pink' },
        { id: 'ad271ea0-d156-4ef1-bafb-aba035b0924b', value: 'ICON', label: 'Visionary', position: 7, color: 'purple' },
      ],
    },
    {
      universalIdentifier: '24db6009-9953-4ed5-81b8-ee507a4dd2c6',
      type: FieldType.SELECT,
      name: 'accountType',
      label: 'Account type',
      icon: 'IconUserCog',
      description: 'Mirrors Supabase affiliates.account_type.',
      defaultValue: "'AMBASSADOR'",
      options: [
        { id: '84fba524-a097-4427-ab54-dcabb4e795e8', value: 'AMBASSADOR', label: 'Ambassador', position: 0, color: 'purple' },
        { id: '7d00fde5-708b-46cc-bde1-93ec71c32131', value: 'CUSTOMER_ONLY', label: 'Customer only', position: 1, color: 'gray' },
      ],
    },
    { universalIdentifier: 'e6772271-9b15-484e-8f74-8a1566b4ff47', type: FieldType.TEXT, name: 'referralCode', label: 'Referral code', icon: 'IconTicket' },
    { universalIdentifier: '1ad4b2c6-ac99-4e92-bb32-56fd78482643', type: FieldType.TEXT, name: 'trackingCode', label: 'Tracking code', icon: 'IconBarcode', description: 'Mirrors Supabase affiliates.tracking_code.' },
    { universalIdentifier: '9a221036-abc8-4edb-ad4f-5434603da4d2', type: FieldType.TEXT, name: 'customSlug', label: 'Custom slug', icon: 'IconLink' },
    { universalIdentifier: '1bdfadb7-f157-4c2f-9b39-b735c1d71b9a', type: FieldType.NUMBER, name: 'commissionRate', label: 'Commission rate %', icon: 'IconPercentage', defaultValue: 0 },
    { universalIdentifier: XOPURE_AMBASSADOR_ATTRIBUTED_REVENUE_FIELD_ID, type: FieldType.NUMBER, name: 'attributedRevenue', label: 'Attributed revenue', icon: 'IconCurrencyDollar', defaultValue: 0 },
    { universalIdentifier: XOPURE_AMBASSADOR_TOTAL_COMMISSION_EARNED_FIELD_ID, type: FieldType.NUMBER, name: 'totalCommissionEarned', label: 'Commission earned', icon: 'IconCash', defaultValue: 0 },

    // ── Eligibility & volumes (COMP_PLAN_LAW §1.3) ──────────────────────────
    { universalIdentifier: '88ca5d2c-9358-40bd-b493-84d471ffd6a9', type: FieldType.NUMBER, name: 'activeCustomerCount', label: 'Active customers', icon: 'IconUsers', defaultValue: 0, description: 'Counts toward the rank customer requirement.' },
    { universalIdentifier: '149b4bf7-6b26-4d3e-86da-60d05599f93c', type: FieldType.NUMBER, name: 'enrollmentCount', label: 'Enrollments', icon: 'IconUserPlus', defaultValue: 0 },
    { universalIdentifier: '992e95d3-6a82-4061-95f8-d96c7df7c318', type: FieldType.CURRENCY, name: 'personalVolume', label: 'Personal volume', icon: 'IconCoin', description: 'affiliates.personal_volume_cents. Stored in cents upstream.' },
    { universalIdentifier: 'fa60a379-0c15-49a3-86a0-d277e50851dc', type: FieldType.CURRENCY, name: 'teamVolume', label: 'Team volume', icon: 'IconCoins', description: 'affiliates.team_volume_cents.' },
    { universalIdentifier: '5dd67a21-8610-4aef-b07b-b78388007ee2', type: FieldType.CURRENCY, name: 'monthlyPvCv', label: 'Monthly PV (CV)', icon: 'IconChartBar', description: 'affiliates.monthly_pv_cv_cents. CV basis = 50% of retail.' },
    { universalIdentifier: '17d16503-6e86-406c-8bdd-dfa66b30431f', type: FieldType.CURRENCY, name: 'monthlyGvCv', label: 'Monthly GV (CV)', icon: 'IconChartAreaLine', description: 'affiliates.monthly_gv_cv_cents. Drives the rank GV threshold.' },

    // ── Genealogy health (guide §5) ─────────────────────────────────────────
    { universalIdentifier: '91da05d6-61a6-4cd6-ac64-2ef43f945c82', type: FieldType.BOOLEAN, name: 'needsSponsorReview', label: 'Needs sponsor review', icon: 'IconAlertTriangle', description: 'Attribution needs a human decision. A NULL sponsor is a genealogy root — present as "review", not "error".' },
    { universalIdentifier: 'd14bfd87-9f13-4827-8ebd-97218f6d1931', type: FieldType.BOOLEAN, name: 'reparentLocked', label: 'Reparent locked', icon: 'IconLock' },

    // ── Tree rollups (computed by the sync; drive node size/colour in the viz) ──
    { universalIdentifier: '4c3bdad7-7da6-4f7b-8a7f-be35a889a875', type: FieldType.NUMBER, name: 'directReferralCount', label: 'Direct referrals', icon: 'IconGitBranch', defaultValue: 0, description: 'Number of direct mentees. Computed by the Supabase sync.' },
    { universalIdentifier: '68882793-14c5-4ac5-bd2b-ab6cd54ea9db', type: FieldType.NUMBER, name: 'downlineSize', label: 'Downline size', icon: 'IconBinaryTree', defaultValue: 0, description: 'Total descendants at any depth. Computed by the Supabase sync.' },
    { universalIdentifier: 'cdbc3ff4-acc5-4512-9e2a-08eec2f3bb6a', type: FieldType.NUMBER, name: 'treeDepth', label: 'Tree depth', icon: 'IconStairs', defaultValue: 0, description: 'Generations below this ambassador. 0 = leaf.' },

    // ── Lifecycle timestamps ────────────────────────────────────────────────
    { universalIdentifier: '97edccad-796a-4ca3-85fc-25b33e10450f', type: FieldType.DATE_TIME, name: 'joinedAt', label: 'Joined at', icon: 'IconCalendarPlus', description: 'affiliates.created_at.' },
    { universalIdentifier: 'f8e00f3d-3dbd-47f6-ad33-849995c12384', type: FieldType.DATE_TIME, name: 'convertedToAmbassadorAt', label: 'Converted to ambassador at', icon: 'IconArrowUpCircle' },

    { universalIdentifier: '0de23b2b-a89b-4180-96e5-5c70cb6c6c5b', type: FieldType.TEXT, name: 'researchSummary', label: 'Research summary', icon: 'IconNotes' },
  ],
});
