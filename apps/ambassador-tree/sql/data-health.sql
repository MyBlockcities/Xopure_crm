-- XO Pure — mirror data health.
--
-- STRICTLY READ-ONLY.
--
-- The tree can only show what the sync actually populated. Rather than let a
-- gap render as a confident zero, these counts are surfaced in the UI so an
-- operator can see that a number is missing, not merely small
-- (the §2.6 principle: never silently drop).
--
-- Schema is injected by the caller as a validated identifier.

SELECT
    (SELECT COUNT(*) FROM {{schema}}."_xopureOrder"
      WHERE "deletedAt" IS NULL)                        AS orders_total,

    -- Verified 2026-07-26: this is 128 of 128 on the live workspace. With no
    -- order date there is no activity history and no "ordered → shipped" metric.
    (SELECT COUNT(*) FROM {{schema}}."_xopureOrder"
      WHERE "deletedAt" IS NULL AND "orderedAt" IS NULL) AS orders_missing_date,

    -- Neither the resolved FK nor the external id resolves to an ambassador,
    -- so this order's revenue cannot be attributed to anyone in the tree.
    (SELECT COUNT(*) FROM {{schema}}."_xopureOrder" o
      WHERE o."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM {{schema}}."_xopureAmbassador" a
          WHERE a.id = o."ambassadorId"
             OR a."supabaseAmbassadorId" = o."ambassadorExternalId"
        ))                                              AS orders_unattributed,

    (SELECT COUNT(*) FROM {{schema}}."_xopureCommission"
      WHERE "deletedAt" IS NULL)                        AS commissions_total,

    -- A pay area the CRM cannot map must be surfaced, never dropped (§2.6).
    (SELECT COUNT(*) FROM {{schema}}."_xopureCommission"
      WHERE "deletedAt" IS NULL AND "payArea" IS NULL)   AS commissions_missing_pay_area,

    (SELECT COUNT(*) FROM {{schema}}."_xopureAmbassador"
      WHERE "deletedAt" IS NULL
        AND "sponsorAmbassadorExternalId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM {{schema}}."_xopureAmbassador" s
          WHERE s."supabaseAmbassadorId" = "_xopureAmbassador"."sponsorAmbassadorExternalId"
            AND s."deletedAt" IS NULL
        ))                                              AS ambassadors_broken_sponsor;
