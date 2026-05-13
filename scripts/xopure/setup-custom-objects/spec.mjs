// Declarative XO Pure custom object spec.
//
// Source: custom_objects.md v1.0 (the "XO Pure — Twenty CRM Object Specification"
// block starting at line 723). Each PHASE follows the Implementation Sequence.
//
// Field shape:
//   { name, label, type, icon?, description?, options?, defaultValue?, isUnique? }
//
// Relation shape (one entry creates BOTH ends via createOneRelation):
//   {
//     relationType: 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY',
//     from: { object: <nameSingular>, name, label, icon },  // the "one" side
//     to:   { object: <nameSingular>, name, label, icon },  // the "many" side
//   }
//
// We only model ONE_TO_MANY (always created from the "one" side); MANY_TO_ONE
// is automatically the inverse end. Phase 1 has no MANY_TO_MANY.

const supabaseIdField = {
  name: 'supabaseId',
  label: 'Supabase ID',
  type: 'UUID',
  icon: 'IconKey',
  description: 'Sync key — primary id of the corresponding Supabase row',
  isUnique: true,
};

const tagsField = {
  name: 'crmTags',
  label: 'CRM Tags',
  type: 'MULTI_SELECT',
  icon: 'IconTags',
  description: 'Free-form CRM tags (Twenty-owned)',
  options: [
    { label: 'VIP', value: 'VIP', color: 'purple', position: 0 },
    { label: 'High Risk', value: 'HIGH_RISK', color: 'red', position: 1 },
    { label: 'Watch List', value: 'WATCH_LIST', color: 'orange', position: 2 },
    { label: 'Top Performer', value: 'TOP_PERFORMER', color: 'green', position: 3 },
    { label: 'Needs Outreach', value: 'NEEDS_OUTREACH', color: 'blue', position: 4 },
  ],
};

const communicationPreferencesField = {
  name: 'communicationPreferences',
  label: 'Communication Preferences',
  type: 'MULTI_SELECT',
  icon: 'IconMail',
  options: [
    { label: 'Email', value: 'EMAIL', color: 'blue', position: 0 },
    { label: 'SMS', value: 'SMS', color: 'green', position: 1 },
    { label: 'Call', value: 'CALL', color: 'orange', position: 2 },
    { label: 'Do Not Contact', value: 'DO_NOT_CONTACT', color: 'red', position: 3 },
  ],
};

// ─────────────────────────── PHASE 1: Read views ──────────────────────────

const product = {
  nameSingular: 'product',
  namePlural: 'products',
  labelSingular: 'Product',
  labelPlural: 'Products',
  icon: 'IconPackage',
  description: 'XO Pure product catalog. One row per SKU.',
  fields: [
    supabaseIdField,
    { name: 'sku', label: 'SKU', type: 'TEXT', icon: 'IconHash', isUnique: true },
    {
      name: 'category',
      label: 'Category',
      type: 'SELECT',
      icon: 'IconCategory',
      options: [
        { label: 'NAD+', value: 'NAD', color: 'purple', position: 0 },
        { label: 'MetaLean', value: 'METALEAN', color: 'green', position: 1 },
        { label: 'BPC / TB500', value: 'BPC_TB500', color: 'blue', position: 2 },
        { label: 'Klow', value: 'KLOW', color: 'pink', position: 3 },
        { label: 'Other', value: 'OTHER', color: 'gray', position: 4 },
      ],
    },
    {
      name: 'format',
      label: 'Format',
      type: 'SELECT',
      icon: 'IconBottle',
      options: [
        { label: 'Oral Strip', value: 'ORAL_STRIP', color: 'blue', position: 0 },
        { label: 'Other', value: 'OTHER', color: 'gray', position: 1 },
      ],
    },
    { name: 'retailPrice', label: 'Retail Price', type: 'CURRENCY', icon: 'IconCurrencyDollar' },
    { name: 'cvAmount', label: 'CV Amount', type: 'CURRENCY', icon: 'IconCoin', description: 'Commission Value (usually retail × 0.5)' },
    { name: 'stripePriceId', label: 'Stripe Price ID', type: 'TEXT', icon: 'IconBrandStripe' },
    { name: 'safeDescription', label: 'Safe Description', type: 'RICH_TEXT', icon: 'IconFileDescription', description: 'Compliance-approved product copy' },
    {
      name: 'restrictedClaims',
      label: 'Restricted Claims',
      type: 'MULTI_SELECT',
      icon: 'IconAlertOctagon',
      options: [
        { label: 'No Medical Claims', value: 'NO_MEDICAL_CLAIMS', color: 'red', position: 0 },
        { label: 'No Weight Loss Claims', value: 'NO_WEIGHT_LOSS', color: 'orange', position: 1 },
        { label: 'No Anti-Aging Claims', value: 'NO_ANTI_AGING', color: 'yellow', position: 2 },
      ],
    },
    { name: 'isActive', label: 'Is Active', type: 'BOOLEAN', icon: 'IconToggleRight'},
    { name: 'commissionEligible', label: 'Commission Eligible', type: 'BOOLEAN', icon: 'IconCoin' },
    { name: 'marketingNotes', label: 'Marketing Notes', type: 'RICH_TEXT', icon: 'IconNote', description: 'Twenty-owned. Internal launch/positioning notes.' },
    { ...tagsField },
  ],
};

const period = {
  nameSingular: 'period',
  namePlural: 'periods',
  labelSingular: 'Period',
  labelPlural: 'Periods',
  icon: 'IconCalendarStats',
  description: 'Monthly commission period. Most queries scope by period.',
  fields: [
    supabaseIdField,
    { name: 'periodCode', label: 'Period Code', type: 'TEXT', icon: 'IconHash', description: 'e.g. "2026-04"', isUnique: true },
    { name: 'startDate', label: 'Start Date', type: 'DATE', icon: 'IconCalendarPlus' },
    { name: 'endDate', label: 'End Date', type: 'DATE', icon: 'IconCalendarCheck' },
    {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      options: [
        { label: 'Open', value: 'OPEN', color: 'blue', position: 0 },
        { label: 'Locked', value: 'LOCKED', color: 'orange', position: 1 },
        { label: 'Finalized', value: 'FINALIZED', color: 'purple', position: 2 },
        { label: 'Paid', value: 'PAID', color: 'green', position: 3 },
      ],
      defaultValue: "'OPEN'",
    },
    { name: 'totalRetail', label: 'Total Retail', type: 'CURRENCY', icon: 'IconCurrencyDollar' },
    { name: 'totalCV', label: 'Total CV', type: 'CURRENCY', icon: 'IconCoin' },
    { name: 'totalPayouts', label: 'Total Payouts', type: 'CURRENCY', icon: 'IconCash' },
    { name: 'payoutPercentOfRetail', label: 'Payout % of Retail', type: 'NUMERIC', icon: 'IconPercentage' },
    { name: 'frozenAt', label: 'Frozen At', type: 'DATE_TIME', icon: 'IconLock' },
    { name: 'internalNotes', label: 'Internal Notes', type: 'RICH_TEXT', icon: 'IconNote', description: 'Twenty-owned. Finance notes.' },
  ],
};

const ambassador = {
  nameSingular: 'ambassador',
  namePlural: 'ambassadors',
  labelSingular: 'Ambassador',
  labelPlural: 'Ambassadors',
  icon: 'IconUserCheck',
  description: 'Core registry of every XO Pure ambassador. Identity, sponsor chain, status, current-period rollups.',
  fields: [
    supabaseIdField,
    { name: 'ambassadorCode', label: 'Ambassador Code', type: 'TEXT', icon: 'IconHash', isUnique: true },
    { name: 'fullName', label: 'Full Name', type: 'FULL_NAME', icon: 'IconUser' },
    { name: 'emails', label: 'Emails', type: 'EMAILS', icon: 'IconMail' },
    { name: 'phones', label: 'Phones', type: 'PHONES', icon: 'IconPhone' },
    {
      name: 'path',
      label: 'Path',
      type: 'SELECT',
      icon: 'IconRoute',
      options: [
        { label: 'Standard', value: 'STANDARD', color: 'blue', position: 0 },
        { label: 'Elite', value: 'ELITE', color: 'purple', position: 1 },
        { label: 'Referral', value: 'REFERRAL', color: 'green', position: 2 },
      ],
    },
    { name: 'enrolledAt', label: 'Enrolled At', type: 'DATE_TIME', icon: 'IconCalendarPlus' },
    {
      name: 'qualifiedRank',
      label: 'Qualified Rank',
      type: 'SELECT',
      icon: 'IconStairsUp',
      description: 'v1.3 rank ceiling this ambassador qualifies for',
      options: [
        { label: 'L0 — Customer',  value: 'L0_CUSTOMER',  color: 'gray',   position: 0 },
        { label: 'L1 — Starter',   value: 'L1_STARTER',   color: 'blue',   position: 1 },
        { label: 'L2 — Builder',   value: 'L2_BUILDER',   color: 'sky',    position: 2 },
        { label: 'L3 — Promoter',  value: 'L3_PROMOTER',  color: 'green',  position: 3 },
        { label: 'L4 — Leader',    value: 'L4_LEADER',    color: 'yellow', position: 4 },
        { label: 'L5 — Director',  value: 'L5_DIRECTOR',  color: 'orange', position: 5 },
        { label: 'L6 — Icon',      value: 'L6_ICON',      color: 'purple', position: 6 },
      ],
    },
    {
      name: 'paidAsRank',
      label: 'Paid As Rank',
      type: 'SELECT',
      icon: 'IconStairs',
      description: 'v1.3 rank actually used for the current payout cycle (may be lower than qualifiedRank if dynamic compression kicks in)',
      options: [
        { label: 'L0 — Customer',  value: 'L0_CUSTOMER',  color: 'gray',   position: 0 },
        { label: 'L1 — Starter',   value: 'L1_STARTER',   color: 'blue',   position: 1 },
        { label: 'L2 — Builder',   value: 'L2_BUILDER',   color: 'sky',    position: 2 },
        { label: 'L3 — Promoter',  value: 'L3_PROMOTER',  color: 'green',  position: 3 },
        { label: 'L4 — Leader',    value: 'L4_LEADER',    color: 'yellow', position: 4 },
        { label: 'L5 — Director',  value: 'L5_DIRECTOR',  color: 'orange', position: 5 },
        { label: 'L6 — Icon',      value: 'L6_ICON',      color: 'purple', position: 6 },
      ],
    },
    { name: 'eliteMaintained', label: 'Elite Maintained', type: 'BOOLEAN', icon: 'IconCrown', description: 'Derived flag — true when latest period meets elite maintenance rule' },
    { name: 'eliteQualifiedAt', label: 'Elite Qualified At', type: 'DATE_TIME', icon: 'IconCrown', description: 'v1.3 — when ambassador first qualified for elite path' },
    { name: 'eliteMaintainedAt', label: 'Elite Maintained At', type: 'DATE_TIME', icon: 'IconCrown', description: 'v1.3 — most recent period elite maintenance was confirmed' },
    { name: 'eliteLapsedThisPeriod', label: 'Elite Lapsed This Period', type: 'BOOLEAN', icon: 'IconCrownOff', description: 'v1.3 — flagged when elite maintenance failed in the current period' },
    { name: 'customerCV', label: 'Customer CV', type: 'CURRENCY', icon: 'IconCoin' },
    { name: 'groupCV', label: 'Group CV', type: 'CURRENCY', icon: 'IconUsers' },
    { name: 'personalOrderCV', label: 'Personal Order CV', type: 'CURRENCY', icon: 'IconShoppingCart' },
    { name: 'activeCustomerCount', label: 'Active Customer Count', type: 'NUMBER', icon: 'IconUserCircle' },
    { name: 'personalEnrollments', label: 'Personal Enrollments', type: 'NUMBER', icon: 'IconUserPlus' },
    {
      name: 'currentTier',
      label: 'Current Tier',
      type: 'SELECT',
      icon: 'IconStairs',
      options: [
        { label: 'Tier 1', value: 'TIER1', color: 'gray', position: 0 },
        { label: 'Tier 2', value: 'TIER2', color: 'blue', position: 1 },
        { label: 'Tier 3', value: 'TIER3', color: 'green', position: 2 },
        { label: 'Tier 4', value: 'TIER4', color: 'purple', position: 3 },
      ],
    },
    { name: 'lifetimeEarnings', label: 'Lifetime Earnings', type: 'CURRENCY', icon: 'IconCoins' },
    {
      name: 'onboardingStage',
      label: 'Onboarding Stage',
      type: 'SELECT',
      icon: 'IconRocket',
      description: 'Twenty-owned. Drives the onboarding pipeline view.',
      options: [
        { label: 'Invited', value: 'INVITED', color: 'gray', position: 0 },
        { label: 'Enrolled', value: 'ENROLLED', color: 'blue', position: 1 },
        { label: 'Trained', value: 'TRAINED', color: 'sky', position: 2 },
        { label: 'Active', value: 'ACTIVE', color: 'green', position: 3 },
        { label: 'Coach Needed', value: 'COACH_NEEDED', color: 'orange', position: 4 },
        { label: 'Dormant', value: 'DORMANT', color: 'red', position: 5 },
      ],
      defaultValue: "'INVITED'",
    },
    { ...tagsField },
    { name: 'internalNotes', label: 'Internal Notes', type: 'RICH_TEXT', icon: 'IconNote', description: 'Twenty-owned. Ops team notes.' },
    { ...communicationPreferencesField },
    { name: 'complianceHoldReason', label: 'Compliance Hold Reason', type: 'TEXT', icon: 'IconAlertTriangle', description: 'Twenty-owned, admin-only. Triggers payout hold when set.' },
  ],
};

const customer = {
  nameSingular: 'customer',
  namePlural: 'customers',
  labelSingular: 'Customer',
  labelPlural: 'Customers',
  icon: 'IconUserCircle',
  description: 'End customers who purchase products. Distinct from Ambassador. PII access-controlled by referring relationship.',
  fields: [
    supabaseIdField,
    { name: 'customerCode', label: 'Customer Code', type: 'TEXT', icon: 'IconHash', isUnique: true },
    { name: 'fullName', label: 'Full Name', type: 'FULL_NAME', icon: 'IconUser' },
    { name: 'emails', label: 'Emails', type: 'EMAILS', icon: 'IconMail' },
    { name: 'phones', label: 'Phones', type: 'PHONES', icon: 'IconPhone' },
    { name: 'shippingAddress', label: 'Shipping Address', type: 'ADDRESS', icon: 'IconMapPin' },
    { name: 'enrolledAt', label: 'Enrolled At', type: 'DATE_TIME', icon: 'IconCalendarPlus' },
    { name: 'isActive', label: 'Is Active', type: 'BOOLEAN', icon: 'IconToggleRight', description: 'Last order < 60 days' },
    { name: 'lifetimeCV', label: 'Lifetime CV', type: 'CURRENCY', icon: 'IconCoin' },
    { name: 'lifetimeSpend', label: 'Lifetime Spend', type: 'CURRENCY', icon: 'IconCurrencyDollar' },
    { name: 'lastOrderAt', label: 'Last Order At', type: 'DATE_TIME', icon: 'IconClock' },
    { name: 'orderCount', label: 'Order Count', type: 'NUMBER', icon: 'IconShoppingCart' },
    {
      name: 'subscriptionStatus',
      label: 'Subscription Status',
      type: 'SELECT',
      icon: 'IconRepeat',
      options: [
        { label: 'None', value: 'NONE', color: 'gray', position: 0 },
        { label: 'Active', value: 'ACTIVE', color: 'green', position: 1 },
        { label: 'Paused', value: 'PAUSED', color: 'yellow', position: 2 },
        { label: 'Cancelled', value: 'CANCELLED', color: 'red', position: 3 },
      ],
      defaultValue: "'NONE'",
    },
    { name: 'customerNotes', label: 'Customer Notes', type: 'RICH_TEXT', icon: 'IconNote', description: 'Twenty-owned. Direct ambassador only.' },
    { ...tagsField },
    { ...communicationPreferencesField },
    {
      name: 'acquisitionSource',
      label: 'Acquisition Source',
      type: 'SELECT',
      icon: 'IconFunnel',
      description: 'Twenty-owned. How this customer was acquired.',
      options: [
        { label: 'Direct Link', value: 'DIRECT_LINK', color: 'blue', position: 0 },
        { label: 'Social Post', value: 'SOCIAL_POST', color: 'pink', position: 1 },
        { label: 'Event', value: 'EVENT', color: 'purple', position: 2 },
        { label: 'Referral', value: 'REFERRAL', color: 'green', position: 3 },
        { label: 'Other', value: 'OTHER', color: 'gray', position: 4 },
      ],
    },
  ],
};

const order = {
  nameSingular: 'xoOrder',
  namePlural: 'xoOrders',
  labelSingular: 'Order',
  labelPlural: 'Orders',
  icon: 'IconShoppingCart',
  description: 'Every XO Pure transaction. Links Customer → Ambassador → Commission Lines.',
  fields: [
    supabaseIdField,
    { name: 'orderCode', label: 'Order Code', type: 'TEXT', icon: 'IconHash', isUnique: true },
    { name: 'orderedAt', label: 'Ordered At', type: 'DATE_TIME', icon: 'IconCalendarPlus' },
    { name: 'settledAt', label: 'Settled At', type: 'DATE_TIME', icon: 'IconCheck', description: 'orderedAt + 7d refund window' },
    {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      options: [
        { label: 'Pending', value: 'PENDING', color: 'gray', position: 0 },
        { label: 'Paid', value: 'PAID', color: 'blue', position: 1 },
        { label: 'Shipped', value: 'SHIPPED', color: 'yellow', position: 2 },
        { label: 'Delivered', value: 'DELIVERED', color: 'green', position: 3 },
        { label: 'Refunded', value: 'REFUNDED', color: 'orange', position: 4 },
        { label: 'Chargeback', value: 'CHARGEBACK', color: 'red', position: 5 },
      ],
      defaultValue: "'PENDING'",
    },
    { name: 'quantity', label: 'Quantity', type: 'NUMBER', icon: 'IconStack' },
    { name: 'unitPrice', label: 'Unit Price', type: 'CURRENCY', icon: 'IconCurrencyDollar' },
    { name: 'totalRetail', label: 'Total Retail', type: 'CURRENCY', icon: 'IconReceipt' },
    { name: 'totalCV', label: 'Total CV', type: 'CURRENCY', icon: 'IconCoin', description: 'Always = totalRetail × 0.5' },
    {
      name: 'paymentMethod',
      label: 'Payment Method',
      type: 'SELECT',
      icon: 'IconCreditCard',
      options: [
        { label: 'Stripe', value: 'STRIPE', color: 'purple', position: 0 },
        { label: 'PayPal', value: 'PAYPAL', color: 'blue', position: 1 },
      ],
    },
    { name: 'stripePaymentIntentId', label: 'Stripe Payment Intent ID', type: 'TEXT', icon: 'IconBrandStripe' },
    { name: 'paypalCaptureId', label: 'PayPal Capture ID', type: 'TEXT', icon: 'IconBrandPaypal' },
    { name: 'isPersonalOrder', label: 'Is Personal Order', type: 'BOOLEAN', icon: 'IconUserStar', description: 'Customer = referring ambassador' },
    { name: 'fraudScore', label: 'Fraud Score', type: 'NUMBER', icon: 'IconShieldCheck', description: '0-100' },
    { name: 'fraudFlagged', label: 'Fraud Flagged', type: 'BOOLEAN', icon: 'IconAlertTriangle' },
    { name: 'discountCode', label: 'Discount Code', type: 'TEXT', icon: 'IconDiscount' },
  ],
};

// Note: nameSingular = 'xoOrder' rather than 'order' to avoid colliding with
// SQL reserved word `order` when Twenty materializes the workspace table.

// ─────────────────────────── Phase 1 relations ──────────────────────────
// Always declared as ONE_TO_MANY from the "one" side.

const phase1Relations = [
  // Ambassador (self-ref) — Ambassador has many mentees, each ambassador has one sponsor.
  {
    relationType: 'ONE_TO_MANY',
    from: { object: 'ambassador', name: 'mentees',  label: 'Mentees', icon: 'IconUsersGroup' },
    to:   { object: 'ambassador', name: 'sponsor',  label: 'Sponsor', icon: 'IconCrown' },
  },
  // Ambassador → Customer (referrer)
  {
    relationType: 'ONE_TO_MANY',
    from: { object: 'ambassador', name: 'referredCustomers', label: 'Referred Customers', icon: 'IconUserCircle' },
    to:   { object: 'customer',   name: 'referrer',           label: 'Referrer',           icon: 'IconUserCheck' },
  },
  // Ambassador → Order (referringAmbassador)
  {
    relationType: 'ONE_TO_MANY',
    from: { object: 'ambassador', name: 'referredOrders',      label: 'Referred Orders',      icon: 'IconShoppingCart' },
    to:   { object: 'xoOrder',    name: 'referringAmbassador', label: 'Referring Ambassador', icon: 'IconUserCheck' },
  },
  // Customer → Order
  {
    relationType: 'ONE_TO_MANY',
    from: { object: 'customer', name: 'orders',   label: 'Orders',   icon: 'IconShoppingCart' },
    to:   { object: 'xoOrder',  name: 'customer', label: 'Customer', icon: 'IconUserCircle' },
  },
  // Product → Order
  {
    relationType: 'ONE_TO_MANY',
    from: { object: 'product', name: 'orders',  label: 'Orders',  icon: 'IconShoppingCart' },
    to:   { object: 'xoOrder', name: 'product', label: 'Product', icon: 'IconPackage' },
  },
  // Period → Order
  {
    relationType: 'ONE_TO_MANY',
    from: { object: 'period',  name: 'orders', label: 'Orders', icon: 'IconShoppingCart' },
    to:   { object: 'xoOrder', name: 'period', label: 'Period', icon: 'IconCalendarStats' },
  },
];

// ─────────────────────────── exported phases ──────────────────────────
// Object creation order matters only because relations are created after all
// objects in a phase exist. Within a phase, objects can be created in any
// order. Relations always run after every referenced object exists.

export const PHASES = [
  {
    phase: 1,
    label: 'Read views',
    objects: [product, period, ambassador, customer, order],
    relations: phase1Relations,
  },
  // Phase 2-5 to follow (commissionLine, payment, payoutBatch, ...)
];

export const PHASE_BY_NUMBER = Object.fromEntries(PHASES.map((p) => [p.phase, p]));
