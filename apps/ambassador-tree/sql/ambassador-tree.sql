-- XO Pure — Ambassador genealogy tree
--
-- STRICTLY READ-ONLY. This query is SELECT-only and must be executed by the
-- `crm_readonly` role (GRANT SELECT only). Never run it with a service-role
-- credential.
--
-- Returns one row per ambassador in the requested subtree, already annotated
-- with depth, materialized path, and per-node performance metrics. The client
-- stratifies these flat rows into a nested tree (see src/lib/tree.ts).
--
-- Parameters:
--   $1 :: uuid  root ambassador id. NULL = every genealogy root (whole forest).
--   $2 :: int   max depth to walk. Use a bounded value for lazy loading.
--
-- Why a recursive CTE rather than Twenty's GraphQL: Twenty resolves relations
-- one level at a time and rate limits at 100 req/min, so walking a deep
-- downline there costs one request per generation per node. This is one query.

WITH RECURSIVE

-- ── 1. Walk the genealogy ───────────────────────────────────────────────────
descendants AS (
    -- Anchor: either the requested ambassador, or all roots when $1 is NULL.
    SELECT
        a.id,
        a.parent_id,
        0                AS depth,
        ARRAY[a.id]      AS path
    FROM affiliates a
    WHERE
        CASE
            WHEN $1::uuid IS NULL THEN a.parent_id IS NULL
            ELSE a.id = $1::uuid
        END

    UNION ALL

    SELECT
        child.id,
        child.parent_id,
        parent.depth + 1                AS depth,
        parent.path || child.id         AS path
    FROM affiliates child
    JOIN descendants parent
      ON child.parent_id = parent.id
    WHERE
        -- Cycle guard. A parent_id cycle is a data bug, but it must never be
        -- allowed to spin this query forever.
        NOT (child.id = ANY(parent.path))
        AND parent.depth < $2::int
),

-- ── 2. Per-ambassador order metrics ─────────────────────────────────────────
-- Attribution uses affiliate_chain[1] — the directly credited ambassador.
order_metrics AS (
    SELECT
        (o.affiliate_chain ->> 0)::uuid          AS affiliate_id,
        COUNT(*)                                 AS order_count,
        COALESCE(SUM(o.subtotal_cents), 0)       AS retail_cents,
        COALESCE(SUM(o.cv_amount), 0)            AS cv_cents,
        MAX(o.created_at)                        AS last_order_at
    FROM orders o
    WHERE o.payment_status IN ('paid', 'comp')
      AND o.affiliate_chain IS NOT NULL
      AND jsonb_array_length(o.affiliate_chain) > 0
    GROUP BY 1
),

-- ── 3. Per-ambassador commission metrics ────────────────────────────────────
-- Generation money is monthly/accrued and must never be folded into a weekly
-- payable total (LAW §2.5), so the buckets are kept separate here.
commission_metrics AS (
    SELECT
        cl.affiliate_id,
        COALESCE(SUM(cl.amount_cents) FILTER (
            WHERE cl.status = 'paid'
        ), 0) AS paid_cents,
        COALESCE(SUM(cl.amount_cents) FILTER (
            WHERE cl.status = 'payable'
        ), 0) AS payable_cents,
        COALESCE(SUM(cl.amount_cents) FILTER (
            WHERE cl.status = 'held'
        ), 0) AS held_cents,
        COALESCE(SUM(cl.amount_cents) FILTER (
            WHERE cl.status = 'accrued'
        ), 0) AS accrued_generation_cents,
        COALESCE(SUM(cl.amount_cents) FILTER (
            WHERE cl.status IN ('paid', 'payable', 'held', 'accrued')
        ), 0) AS lifetime_cents
    FROM commission_ledger cl
    GROUP BY 1
),

-- ── 4. Trailing 12-month referral activity, for the heatmap strip ───────────
monthly_activity AS (
    SELECT
        (o.affiliate_chain ->> 0)::uuid                       AS affiliate_id,
        to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS month_code,
        COUNT(*)                                              AS order_count,
        COALESCE(SUM(o.subtotal_cents), 0)                    AS retail_cents
    FROM orders o
    WHERE o.payment_status IN ('paid', 'comp')
      AND o.created_at >= date_trunc('month', now()) - interval '11 months'
      AND o.affiliate_chain IS NOT NULL
      AND jsonb_array_length(o.affiliate_chain) > 0
    GROUP BY 1, 2
),

monthly_activity_rolled AS (
    SELECT
        affiliate_id,
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
    d.id,
    d.parent_id,
    d.depth,
    d.path,

    a.name,
    a.email,
    a.tracking_code,
    a.custom_slug,
    a.account_type,
    a.status,

    -- Raw internal rank keys. The client maps these to spec display names;
    -- a raw key must never be rendered (LAW §2.1).
    a.rank                          AS rank_key,
    a.paid_as_rank                  AS paid_as_rank_key,
    a.career_rank                   AS career_rank_key,

    a.active_customer_count,
    a.enrollment_count,
    a.personal_volume_cents,
    a.team_volume_cents,
    a.monthly_pv_cv_cents,
    a.monthly_gv_cv_cents,

    a.needs_sponsor_review,
    a.reparent_locked,
    a.created_at                    AS joined_at,

    COALESCE(om.order_count, 0)     AS order_count,
    COALESCE(om.retail_cents, 0)    AS retail_cents,
    COALESCE(om.cv_cents, 0)        AS cv_cents,
    om.last_order_at,

    COALESCE(cm.paid_cents, 0)                  AS commission_paid_cents,
    COALESCE(cm.payable_cents, 0)               AS commission_payable_cents,
    COALESCE(cm.held_cents, 0)                  AS commission_held_cents,
    COALESCE(cm.accrued_generation_cents, 0)    AS commission_accrued_generation_cents,
    COALESCE(cm.lifetime_cents, 0)              AS commission_lifetime_cents,

    COALESCE(ma.monthly_activity, '[]'::jsonb)  AS monthly_activity

FROM descendants d
JOIN affiliates a
  ON a.id = d.id
LEFT JOIN order_metrics om
  ON om.affiliate_id = d.id
LEFT JOIN commission_metrics cm
  ON cm.affiliate_id = d.id
LEFT JOIN monthly_activity_rolled ma
  ON ma.affiliate_id = d.id
ORDER BY d.depth, a.name;
