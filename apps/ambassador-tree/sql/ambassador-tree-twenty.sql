-- XO Pure — Ambassador genealogy, read from the TWENTY mirror.
--
-- STRICTLY READ-ONLY. SELECT only.
--
-- Why this exists alongside sql/ambassador-tree.sql (which reads Supabase):
-- the Twenty workspace already carries the resolved genealogy and the comp
-- data, so the visualization needs no Supabase credential at all. Twenty's
-- Postgres is also the record deep-link target, so `id` here is directly
-- linkable — no id translation.
--
-- Genealogy edge: _xopureAmbassador."sponsorAmbassadorExternalId"
--                 -> _xopureAmbassador."supabaseAmbassadorId"
-- (verified 2026-07-25: resolves 211/211 on the live workspace).
--
-- The workspace schema is injected by the caller as a validated identifier —
-- it cannot be a bind parameter because Postgres does not allow parameterized
-- identifiers. See server/twenty-source.ts, which allowlists the pattern.
--
-- Parameters:
--   $1 :: uuid  root ambassador id (Twenty id). NULL = every genealogy root.
--   $2 :: int   max depth to walk.

WITH RECURSIVE

-- ── 1. Walk the genealogy ───────────────────────────────────────────────────
descendants AS (
    SELECT
        a.id,
        a."supabaseAmbassadorId"        AS external_id,
        NULL::uuid                      AS parent_id,
        0                               AS depth,
        ARRAY[a.id]                     AS path
    FROM {{schema}}."_xopureAmbassador" a
    WHERE a."deletedAt" IS NULL
      AND CASE
            WHEN $1::uuid IS NULL THEN
                -- A root is an ambassador with no sponsor, or one whose
                -- sponsor is missing/deleted (an orphan is still a root, and
                -- must appear rather than vanish — guide §5).
                a."sponsorAmbassadorExternalId" IS NULL
                OR NOT EXISTS (
                    SELECT 1 FROM {{schema}}."_xopureAmbassador" s
                    WHERE s."supabaseAmbassadorId" = a."sponsorAmbassadorExternalId"
                      AND s."deletedAt" IS NULL
                )
            ELSE a.id = $1::uuid
          END

    UNION ALL

    SELECT
        child.id,
        child."supabaseAmbassadorId",
        parent.id                       AS parent_id,
        parent.depth + 1                AS depth,
        parent.path || child.id         AS path
    FROM {{schema}}."_xopureAmbassador" child
    JOIN descendants parent
      ON child."sponsorAmbassadorExternalId" = parent.external_id
    WHERE child."deletedAt" IS NULL
      -- Cycle guard. A sponsor cycle is a data bug, but it must never be
      -- allowed to spin this query forever.
      AND NOT (child.id = ANY(parent.path))
      AND parent.depth < $2::int
),

-- ── 2. Per-ambassador order metrics ─────────────────────────────────────────
-- Prefer the resolved FK; fall back to the external id, because only 91 of 128
-- live orders carry "ambassadorId" (verified 2026-07-25). Dropping the rest
-- would silently understate revenue.
order_metrics AS (
    SELECT
        amb.id                                          AS ambassador_id,
        COUNT(*)                                        AS order_count,
        COALESCE(SUM(o."subtotalCents"), 0)::bigint     AS retail_cents,
        COALESCE(SUM(o."cvAmount"), 0)::bigint          AS cv_cents,
        MAX(o."orderedAt")                              AS last_order_at
    FROM {{schema}}."_xopureOrder" o
    JOIN {{schema}}."_xopureAmbassador" amb
      ON amb.id = o."ambassadorId"
      OR amb."supabaseAmbassadorId" = o."ambassadorExternalId"
    WHERE o."deletedAt" IS NULL
      -- Only money that actually landed counts as volume. 'comp' orders ship
      -- but carry no retail, so they are excluded from revenue here.
      AND o."paymentStatus"::text = 'PAID'
    GROUP BY 1
),

-- ── 3. Per-ambassador commission metrics ────────────────────────────────────
-- Generation money is monthly/accrued and must never be folded into a weekly
-- payable total (LAW §2.5), so the buckets are kept separate.
--
-- The Twenty mirror's status vocabulary is PENDING/HELD/APPROVED/VOID, which
-- is NOT the Supabase commission_ledger vocabulary the guide documents.
commission_metrics AS (
    SELECT
        amb.id                                          AS ambassador_id,
        COALESCE(SUM(c."amountCents") FILTER (
            WHERE c.status::text = 'PAID'
        ), 0)::bigint                                   AS paid_cents,
        COALESCE(SUM(c."amountCents") FILTER (
            WHERE c.status::text = 'APPROVED'
              AND c."payArea"::text NOT LIKE 'GENERATION%'
        ), 0)::bigint                                   AS payable_cents,
        COALESCE(SUM(c."amountCents") FILTER (
            WHERE c.status::text IN ('HELD', 'PENDING')
              AND c."payArea"::text NOT LIKE 'GENERATION%'
        ), 0)::bigint                                   AS held_cents,
        COALESCE(SUM(c."amountCents") FILTER (
            WHERE c."payArea"::text LIKE 'GENERATION%'
        ), 0)::bigint                                   AS accrued_generation_cents,
        COALESCE(SUM(c."amountCents") FILTER (
            WHERE c.status::text <> 'VOID'
        ), 0)::bigint                                   AS lifetime_cents
    FROM {{schema}}."_xopureCommission" c
    JOIN {{schema}}."_xopureAmbassador" amb
      ON amb.id = c."ambassadorId"
      OR amb."supabaseAmbassadorId" = c."ambassadorExternalId"
    WHERE c."deletedAt" IS NULL
    GROUP BY 1
),

-- ── 4. Trailing 12-month activity, for the heatmap strip ────────────────────
monthly_activity AS (
    SELECT
        amb.id                                                  AS ambassador_id,
        to_char(date_trunc('month', o."orderedAt"), 'YYYY-MM')  AS month_code,
        COUNT(*)                                                AS order_count,
        COALESCE(SUM(o."subtotalCents"), 0)::bigint             AS retail_cents
    FROM {{schema}}."_xopureOrder" o
    JOIN {{schema}}."_xopureAmbassador" amb
      ON amb.id = o."ambassadorId"
      OR amb."supabaseAmbassadorId" = o."ambassadorExternalId"
    WHERE o."deletedAt" IS NULL
      AND o."paymentStatus"::text = 'PAID'
      AND o."orderedAt" >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1, 2
),

monthly_activity_rolled AS (
    SELECT
        ambassador_id,
        jsonb_agg(
            jsonb_build_object(
                'month',       month_code,
                'orderCount',  order_count,
                'retailCents', retail_cents
            )
            ORDER BY month_code
        ) AS monthly_activity
    FROM monthly_activity
    GROUP BY 1
)

-- ── 5. Assemble ─────────────────────────────────────────────────────────────
SELECT
    d.id::text                          AS id,
    d.parent_id::text                   AS parent_id,
    d.depth,

    a.name,
    a.email,
    a.status::text                      AS status,
    NULL::text                          AS account_type,

    -- Raw internal rank keys. The client maps these to spec display names;
    -- a raw key must never be rendered (LAW §2.1).
    a."paidAsRank"::text                AS paid_as_rank_key,
    a."careerRank"::text                AS career_rank_key,
    NULL::text                          AS rank_key,

    COALESCE(a."activeCustomerCount", 0)::int   AS active_customer_count,

    -- Retail and CV must come from the SAME source, or the pair is a lie:
    -- CV is 50% of retail (§1.2), and the UI renders them together. Falling
    -- back to a."attributedRevenueCents" here (a Supabase rollup that has no
    -- matching CV) produced "$34,155 retail · $6,415 CV", which reads as a bug.
    -- Measured order volume only. An ambassador whose orders are not linked
    -- shows 0, which honestly surfaces the FK gap instead of papering over it.
    COALESCE(om.retail_cents, 0)::bigint        AS retail_cents,
    COALESCE(om.cv_cents, 0)::bigint            AS cv_cents,
    COALESCE(om.order_count, 0)::int            AS order_count,
    -- Same rule: measured ledger rows only, so this reconciles with the
    -- payable / held / accrued split below.
    COALESCE(cm.lifetime_cents, 0)::bigint      AS commission_lifetime_cents,

    COALESCE(cm.paid_cents, 0)::bigint                  AS commission_paid_cents,
    COALESCE(cm.payable_cents, 0)::bigint               AS commission_payable_cents,
    COALESCE(cm.held_cents, 0)::bigint                  AS commission_held_cents,
    COALESCE(cm.accrued_generation_cents, 0)::bigint    AS commission_accrued_generation_cents,

    -- The mirror has no needs_sponsor_review flag; an unresolved sponsor is
    -- the equivalent signal and is what a human has to act on (guide §5).
    (a."sponsorAmbassadorExternalId" IS NOT NULL AND d.parent_id IS NULL)
                                                AS needs_sponsor_review,

    a."createdAt"                       AS joined_at,
    om.last_order_at,

    COALESCE(ma.monthly_activity, '[]'::jsonb)  AS monthly_activity

FROM descendants d
JOIN {{schema}}."_xopureAmbassador" a
  ON a.id = d.id
LEFT JOIN order_metrics om          ON om.ambassador_id = d.id
LEFT JOIN commission_metrics cm     ON cm.ambassador_id = d.id
LEFT JOIN monthly_activity_rolled ma ON ma.ambassador_id = d.id
ORDER BY d.depth, a.name;
