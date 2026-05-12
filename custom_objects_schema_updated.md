-- =============================================================================
-- XO Pure Affiliate Platform — Schema v1.3
-- Final canonical schema for comp plan v1.3.
--
-- DESIGN: Non-destructive overlay on your existing v1.2 schema.
--   - Adds new v1.3 columns alongside v1.2 ones
--   - Deactivates (does not drop) legacy rank seed rows
--   - Inserts new v1.3 config + L0–L6 ranks
--   - Preserves all existing materialized views, RLS, and triggers
--
-- Safe to run on existing schema OR fresh project. Idempotent throughout.
-- Run once in Supabase SQL Editor on top of your current schema.
--
-- KEY v1.3 CHANGES:
--   1. Tiered L1 (30/35/40/45 at $5K/$10K/$25K thresholds) — replaces single
--      commissionable_rate. Old field stays in table, ignored by new code.
--   2. Standard vs Elite paths for L2-L4. New `path` column on affiliates.
--   3. 4-gen dynamic compression (was 5 gens, no compression).
--   4. 3-tier milestone bonuses (Bronze/Silver/Gold) — replaces 2-tier direct_bonus.
--   5. Fast Start as 2% pool (was level-based percentages).
--   6. Elite maintenance: 5 active customers + $2K GV + $125 personal CV.
--   7. Hold period: 7 days (was 14).
--   8. Rank model: L0-Customer through L6-Icon (was active_affiliate/builder/etc).
--   9. CV ratio: 0.5 (explicit field added).
--
-- DEPRECATED FIELDS (left in tables, ignored by v1.3 engine):
--   commission_config_versions:
--     - commissionable_rate
--     - fast_start_l1_pct, fast_start_l2_pct, fast_start_l3_pct, fast_start_compression_mode
--     - generation_g1_pct..generation_g5_pct (individual rates; replaced by single generation_rate)
--     - direct_bonus_* (all)
--     - personal_sub_* (all)
--     - customer_commission_* (all)
--   rank_definitions:
--     - customer_commission_pct
--     - requires_active_subscription
--   affiliates:
--     - account_type (use `path` instead)
--   period_snapshots:
--     - active_subscription_flag
-- =============================================================================


-- =============================================================================
-- SECTION 1: ADDITIVE COLUMNS FOR v1.3
-- =============================================================================

-- commission_config_versions: v1.3 fields
ALTER TABLE public.commission_config_versions
  ADD COLUMN IF NOT EXISTS version_code TEXT,
  ADD COLUMN IF NOT EXISTS cv_to_retail_ratio NUMERIC(5,4) DEFAULT 0.5,
  -- Tiered L1 waterfall
  ADD COLUMN IF NOT EXISTS l1_tier1_rate NUMERIC(5,4) DEFAULT 0.30,
  ADD COLUMN IF NOT EXISTS l1_tier1_ceiling_cents BIGINT DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS l1_tier2_rate NUMERIC(5,4) DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS l1_tier2_ceiling_cents BIGINT DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS l1_tier3_rate NUMERIC(5,4) DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS l1_tier3_ceiling_cents BIGINT DEFAULT 2500000,
  ADD COLUMN IF NOT EXISTS l1_tier4_rate NUMERIC(5,4) DEFAULT 0.45,
  -- Standard vs Elite L2-L4
  ADD COLUMN IF NOT EXISTS standard_l2_rate NUMERIC(5,4) DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS standard_l3_rate NUMERIC(5,4) DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS standard_l4_rate NUMERIC(5,4) DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS elite_l2_rate NUMERIC(5,4) DEFAULT 0.12,
  ADD COLUMN IF NOT EXISTS elite_l3_rate NUMERIC(5,4) DEFAULT 0.06,
  ADD COLUMN IF NOT EXISTS elite_l4_rate NUMERIC(5,4) DEFAULT 0.02,
  -- Elite qualification & maintenance
  ADD COLUMN IF NOT EXISTS elite_qualify_min_enrollments INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS elite_qualify_pack_cents INTEGER DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS elite_qualify_min_group_cv_cents BIGINT DEFAULT 200000,
  ADD COLUMN IF NOT EXISTS elite_qualify_bonus_cents INTEGER DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS elite_maint_min_active_customers INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS elite_maint_min_group_cv_cents BIGINT DEFAULT 200000,
  ADD COLUMN IF NOT EXISTS elite_maint_min_personal_order_cv_cents BIGINT DEFAULT 12500,
  -- Generations (unified rate across 4 gens)
  ADD COLUMN IF NOT EXISTS generation_rate NUMERIC(5,4) DEFAULT 0.04,
  ADD COLUMN IF NOT EXISTS generation_max_count SMALLINT DEFAULT 4,
  ADD COLUMN IF NOT EXISTS generation_compression_enabled BOOLEAN DEFAULT true,
  -- 3-tier milestone bonuses
  ADD COLUMN IF NOT EXISTS milestone_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS milestone_bronze_threshold_cents BIGINT DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS milestone_bronze_bonus_cents INTEGER DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS milestone_silver_threshold_cents BIGINT DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS milestone_silver_bonus_cents INTEGER DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS milestone_gold_threshold_cents BIGINT DEFAULT 2500000,
  ADD COLUMN IF NOT EXISTS milestone_gold_bonus_cents INTEGER DEFAULT 300000,
  ADD COLUMN IF NOT EXISTS milestone_stacking_enabled BOOLEAN DEFAULT true,
  -- Fast Start (pool-based)
  ADD COLUMN IF NOT EXISTS fast_start_pool_pct NUMERIC(5,4) DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS fast_start_qualifying_window_days INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS fast_start_min_enrollments INTEGER DEFAULT 1,
  -- Guardrails
  ADD COLUMN IF NOT EXISTS fraud_hold_blocks_payout BOOLEAN DEFAULT true,
  -- Metadata
  ADD COLUMN IF NOT EXISTS change_notes TEXT;

-- Unique constraint on version_code (added after column exists, before seed insert)
DO $$ BEGIN
  ALTER TABLE public.commission_config_versions
    ADD CONSTRAINT commission_config_versions_version_code_key UNIQUE (version_code);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- rank_definitions: v1.3 fields
ALTER TABLE public.rank_definitions
  ADD COLUMN IF NOT EXISTS min_personal_order_cv_cents BIGINT DEFAULT 0;

-- Default the legacy requires_active_subscription to false for new v1.3 ranks
ALTER TABLE public.rank_definitions
  ALTER COLUMN requires_active_subscription SET DEFAULT false;

-- affiliates: v1.3 fields
ALTER TABLE public.affiliates
  -- Path (replaces account_type)
  ADD COLUMN IF NOT EXISTS path TEXT DEFAULT 'standard',
  -- Current-period rollups
  ADD COLUMN IF NOT EXISTS customer_cv_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_order_cv_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_tier SMALLINT DEFAULT 1,
  -- Elite tracking
  ADD COLUMN IF NOT EXISTS elite_qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS elite_maintained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS elite_lapsed_this_period BOOLEAN DEFAULT false;

-- Constraints
DO $$ BEGIN
  ALTER TABLE public.affiliates
    ADD CONSTRAINT chk_affiliates_path CHECK (path IN ('standard','elite','referral'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.affiliates
    ADD CONSTRAINT chk_affiliates_current_tier CHECK (current_tier BETWEEN 1 AND 4);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Migrate account_type to path for existing rows (only on first run)
UPDATE public.affiliates
SET path = CASE
  WHEN account_type IN ('elite','elite_leader') THEN 'elite'
  WHEN account_type = 'referral' THEN 'referral'
  ELSE 'standard'
END
WHERE path = 'standard' AND account_type IS NOT NULL AND account_type != 'standard';

-- commission_ledger: v1.3 fields
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS tier_bracket SMALLINT,
  ADD COLUMN IF NOT EXISTS compression_applied BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS skipped_ancestors JSONB,
  ADD COLUMN IF NOT EXISTS hold_until_v13 TIMESTAMPTZ;  -- recomputed per v1.3 7-day rule

DO $$ BEGIN
  ALTER TABLE public.commission_ledger
    ADD CONSTRAINT chk_commission_ledger_tier_bracket
    CHECK (tier_bracket IS NULL OR tier_bracket BETWEEN 1 AND 4);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Widen base_cv_amount from INTEGER to BIGINT (safe — INTEGER values fit in BIGINT)
DO $$ BEGIN
  ALTER TABLE public.commission_ledger ALTER COLUMN base_cv_amount TYPE BIGINT;
EXCEPTION WHEN others THEN null;
END $$;

-- Constrain pay_area to v1.3 values (won't fail if existing rows have legacy values;
-- new inserts must use these)
DO $$ BEGIN
  ALTER TABLE public.commission_ledger
    ADD CONSTRAINT chk_commission_ledger_pay_area
    CHECK (pay_area IS NULL OR pay_area IN (
      'tiered_l1','l2','l3','l4',
      'gen_1','gen_2','gen_3','gen_4',
      'milestone_bronze','milestone_silver','milestone_gold',
      'fast_start',
      -- legacy pay_area values, accepted for historical rows:
      'l1','direct_bonus_tier1','direct_bonus_tier2','fast_start_l1','fast_start_l2','fast_start_l3',
      'generation_g1','generation_g2','generation_g3','generation_g4','generation_g5',
      'customer_commission','personal_sub'
    ));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Status check
DO $$ BEGIN
  ALTER TABLE public.commission_ledger
    ADD CONSTRAINT chk_commission_ledger_status
    CHECK (status IN ('held','payable','paid','reversed','clawback'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- commission_periods: v1.3 fields
ALTER TABLE public.commission_periods
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS total_retail_cents BIGINT,
  ADD COLUMN IF NOT EXISTS total_payouts_cents BIGINT,
  ADD COLUMN IF NOT EXISTS payout_pct_of_retail NUMERIC(5,4);

-- period_snapshots: v1.3 fields
ALTER TABLE public.period_snapshots
  ADD COLUMN IF NOT EXISTS path TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS elite_maintained BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_cv_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_order_cv_cents BIGINT DEFAULT 0;


-- =============================================================================
-- SECTION 2: NEW INDEXES FOR v1.3 QUERY PATTERNS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_affiliates_path ON public.affiliates(path);
CREATE INDEX IF NOT EXISTS idx_affiliates_current_tier ON public.affiliates(current_tier);
CREATE INDEX IF NOT EXISTS idx_affiliates_elite_maintained ON public.affiliates(elite_maintained_at)
  WHERE path = 'elite';
CREATE INDEX IF NOT EXISTS idx_commission_ledger_compression
  ON public.commission_ledger(compression_applied) WHERE compression_applied = true;
CREATE INDEX IF NOT EXISTS idx_commission_ledger_tier_bracket
  ON public.commission_ledger(tier_bracket) WHERE tier_bracket IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commission_periods_dates
  ON public.commission_periods(start_date, end_date);


-- =============================================================================
-- SECTION 3: v1.3 BUSINESS LOGIC FUNCTIONS
-- =============================================================================

-- Tiered L1 waterfall calculation
-- Given a CV amount, returns the total L1 commission across all applicable tiers.
CREATE OR REPLACE FUNCTION public.calc_tiered_l1_commission(
  p_cv_cents BIGINT,
  p_config_id UUID DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  cfg public.commission_config_versions;
  total BIGINT := 0;
  remaining BIGINT;
BEGIN
  IF p_config_id IS NULL THEN
    SELECT * INTO cfg FROM public.get_active_commission_config();
  ELSE
    SELECT * INTO cfg FROM public.commission_config_versions WHERE id = p_config_id;
  END IF;

  IF cfg IS NULL OR p_cv_cents <= 0 THEN RETURN 0; END IF;

  -- Tier 1: $0 to ceiling1 at rate1
  total := total + (LEAST(p_cv_cents, cfg.l1_tier1_ceiling_cents) * cfg.l1_tier1_rate)::BIGINT;

  -- Tier 2
  IF p_cv_cents > cfg.l1_tier1_ceiling_cents THEN
    remaining := LEAST(p_cv_cents, cfg.l1_tier2_ceiling_cents) - cfg.l1_tier1_ceiling_cents;
    total := total + (remaining * cfg.l1_tier2_rate)::BIGINT;
  END IF;

  -- Tier 3
  IF p_cv_cents > cfg.l1_tier2_ceiling_cents THEN
    remaining := LEAST(p_cv_cents, cfg.l1_tier3_ceiling_cents) - cfg.l1_tier2_ceiling_cents;
    total := total + (remaining * cfg.l1_tier3_rate)::BIGINT;
  END IF;

  -- Tier 4: uncapped
  IF p_cv_cents > cfg.l1_tier3_ceiling_cents THEN
    total := total + ((p_cv_cents - cfg.l1_tier3_ceiling_cents) * cfg.l1_tier4_rate)::BIGINT;
  END IF;

  RETURN total;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Determine which tier a given cumulative CV amount falls into
CREATE OR REPLACE FUNCTION public.get_l1_tier(
  p_cv_cents BIGINT,
  p_config_id UUID DEFAULT NULL
)
RETURNS SMALLINT AS $$
DECLARE
  cfg public.commission_config_versions;
BEGIN
  IF p_config_id IS NULL THEN
    SELECT * INTO cfg FROM public.get_active_commission_config();
  ELSE
    SELECT * INTO cfg FROM public.commission_config_versions WHERE id = p_config_id;
  END IF;

  IF cfg IS NULL THEN RETURN 1; END IF;
  IF p_cv_cents >= cfg.l1_tier3_ceiling_cents THEN RETURN 4; END IF;
  IF p_cv_cents >= cfg.l1_tier2_ceiling_cents THEN RETURN 3; END IF;
  IF p_cv_cents >= cfg.l1_tier1_ceiling_cents THEN RETURN 2; END IF;
  RETURN 1;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Marginal rate for the next sale, given current cumulative CV
CREATE OR REPLACE FUNCTION public.get_marginal_l1_rate(
  p_cv_cents BIGINT,
  p_config_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  cfg public.commission_config_versions;
BEGIN
  IF p_config_id IS NULL THEN
    SELECT * INTO cfg FROM public.get_active_commission_config();
  ELSE
    SELECT * INTO cfg FROM public.commission_config_versions WHERE id = p_config_id;
  END IF;

  IF cfg IS NULL THEN RETURN 0.30; END IF;
  IF p_cv_cents >= cfg.l1_tier3_ceiling_cents THEN RETURN cfg.l1_tier4_rate; END IF;
  IF p_cv_cents >= cfg.l1_tier2_ceiling_cents THEN RETURN cfg.l1_tier3_rate; END IF;
  IF p_cv_cents >= cfg.l1_tier1_ceiling_cents THEN RETURN cfg.l1_tier2_rate; END IF;
  RETURN cfg.l1_tier1_rate;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Milestone bonus calculation (Bronze/Silver/Gold)
CREATE OR REPLACE FUNCTION public.calc_milestone_bonuses(
  p_cv_cents BIGINT,
  p_config_id UUID DEFAULT NULL
)
RETURNS TABLE(bronze_cents INTEGER, silver_cents INTEGER, gold_cents INTEGER, total_cents INTEGER) AS $$
DECLARE
  cfg public.commission_config_versions;
  b INTEGER := 0; s INTEGER := 0; g INTEGER := 0;
BEGIN
  IF p_config_id IS NULL THEN
    SELECT * INTO cfg FROM public.get_active_commission_config();
  ELSE
    SELECT * INTO cfg FROM public.commission_config_versions WHERE id = p_config_id;
  END IF;

  IF cfg IS NULL OR NOT cfg.milestone_enabled THEN
    RETURN QUERY SELECT 0, 0, 0, 0; RETURN;
  END IF;

  IF p_cv_cents >= cfg.milestone_bronze_threshold_cents THEN b := cfg.milestone_bronze_bonus_cents; END IF;
  IF p_cv_cents >= cfg.milestone_silver_threshold_cents THEN s := cfg.milestone_silver_bonus_cents; END IF;
  IF p_cv_cents >= cfg.milestone_gold_threshold_cents THEN g := cfg.milestone_gold_bonus_cents; END IF;

  RETURN QUERY SELECT b, s, g, (b + s + g);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Elite maintenance check
CREATE OR REPLACE FUNCTION public.check_elite_maintained(
  p_affiliate_id UUID,
  p_config_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  cfg public.commission_config_versions;
  aff public.affiliates;
BEGIN
  IF p_config_id IS NULL THEN
    SELECT * INTO cfg FROM public.get_active_commission_config();
  ELSE
    SELECT * INTO cfg FROM public.commission_config_versions WHERE id = p_config_id;
  END IF;

  SELECT * INTO aff FROM public.affiliates WHERE id = p_affiliate_id;
  IF aff IS NULL OR aff.path != 'elite' THEN RETURN false; END IF;

  RETURN
    aff.active_customer_count >= cfg.elite_maint_min_active_customers
    AND aff.team_volume_cents >= cfg.elite_maint_min_group_cv_cents
    AND aff.personal_order_cv_cents >= cfg.elite_maint_min_personal_order_cv_cents;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Effective path (Elite if maintained, else Standard; Referral always Referral)
CREATE OR REPLACE FUNCTION public.get_effective_path(p_affiliate_id UUID)
RETURNS TEXT AS $$
DECLARE
  aff public.affiliates;
  maintained BOOLEAN;
BEGIN
  SELECT * INTO aff FROM public.affiliates WHERE id = p_affiliate_id;
  IF aff IS NULL THEN RETURN 'standard'; END IF;
  IF aff.path = 'referral' THEN RETURN 'referral'; END IF;
  IF aff.path = 'elite' THEN
    SELECT public.check_elite_maintained(p_affiliate_id) INTO maintained;
    RETURN CASE WHEN maintained THEN 'elite' ELSE 'standard' END;
  END IF;
  RETURN 'standard';
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Rank evaluator (v1.3 — uses min_personal_order_cv_cents, drops subscription requirement)
CREATE OR REPLACE FUNCTION public.evaluate_affiliate_rank_v13(
  p_active_customer_count INTEGER,
  p_personal_order_cv_cents BIGINT,
  p_team_volume_cents BIGINT
)
RETURNS public.rank_definitions AS $$
  SELECT * FROM public.rank_definitions
  WHERE is_active = true
    AND min_active_customers <= p_active_customer_count
    AND min_personal_order_cv_cents <= p_personal_order_cv_cents
    AND min_team_volume_cents <= p_team_volume_cents
  ORDER BY rank_order DESC LIMIT 1;
$$ LANGUAGE sql STABLE SET search_path = public;

-- Find next qualified upline for dynamic compression
CREATE OR REPLACE FUNCTION public.find_next_qualified_upline(
  p_starting_affiliate_id UUID,
  p_threshold_rank_order INTEGER,
  p_already_paid UUID[] DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  current_id UUID := p_starting_affiliate_id;
  parent_id UUID;
  current_rank_order INTEGER;
  max_walk INTEGER := 1000;
  walked INTEGER := 0;
BEGIN
  LOOP
    SELECT a.parent_id INTO parent_id FROM public.affiliates a WHERE a.id = current_id;
    EXIT WHEN parent_id IS NULL OR walked >= max_walk;
    walked := walked + 1;

    -- Skip already-paid ancestors in this commission run
    IF parent_id = ANY(p_already_paid) THEN
      current_id := parent_id;
      CONTINUE;
    END IF;

    SELECT rd.rank_order INTO current_rank_order
    FROM public.affiliates a
    JOIN public.rank_definitions rd ON rd.rank_code = a.paid_as_rank
    WHERE a.id = parent_id;

    IF current_rank_order IS NOT NULL AND current_rank_order >= p_threshold_rank_order THEN
      RETURN parent_id;
    END IF;

    current_id := parent_id;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;


-- =============================================================================
-- SECTION 4: RELAX CHAIN DEPTH GUARD
-- v1.2 capped chain depth at 5 levels. v1.3 allows unlimited depth (dynamic
-- compression handles deep orgs), but warns on suspicious depth.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_affiliate_chain_depth()
RETURNS TRIGGER AS $$
DECLARE chain_depth INTEGER;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Affiliate cannot be its own parent'; END IF;
  WITH RECURSIVE chain AS (
    SELECT parent_id, 1 AS depth, ARRAY[NEW.id] AS visited
    FROM public.affiliates WHERE id = NEW.parent_id
    UNION ALL
    SELECT a.parent_id, c.depth + 1, c.visited || a.id
    FROM public.affiliates a
    JOIN chain c ON a.id = c.parent_id
    WHERE c.depth < 100 AND NOT (a.id = ANY(c.visited))
  )
  SELECT MAX(depth) INTO chain_depth FROM chain;
  IF chain_depth >= 50 THEN
    RAISE WARNING 'Affiliate chain depth is %, unusually deep — possible cycle', chain_depth;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- =============================================================================
-- SECTION 5: SEED DATA UPDATES (v1.3)
-- =============================================================================

-- 5a. Deactivate legacy v1.2 ranks (preserve data, hide from rank evaluator)
UPDATE public.rank_definitions
SET is_active = false, updated_at = now()
WHERE rank_code IN ('active_affiliate','builder','leader','elite_leader','icon','legend')
  AND rank_code NOT IN ('l0_customer','l1_starter','l2_builder','l3_promoter','l4_leader','l5_director','l6_icon');

-- 5b. Insert v1.3 ranks (L0-Customer through L6-Icon)
-- min_personal_order_cv_cents = the maintenance personal order CV requirement
-- ($100 retail × 0.5 CV = $50 = 5000 cents at L1, etc.)
INSERT INTO public.rank_definitions
  (rank_code, rank_name, rank_order,
   min_active_customers, min_personal_order_cv_cents, min_personal_volume_cents,
   min_team_volume_cents, requires_active_subscription, unlocked_generations,
   customer_commission_pct, is_active)
VALUES
  ('l0_customer',  'L0-Customer',  0,  0,  0,      0, 0,        false, 0, 0.00, true),
  ('l1_starter',   'L1-Starter',   1,  1,  5000,   0, 0,        false, 0, 0.00, true),
  ('l2_builder',   'L2-Builder',   2,  2,  10000,  0, 100000,   false, 0, 0.00, true),
  ('l3_promoter',  'L3-Promoter',  3,  4,  12500,  0, 500000,   false, 1, 0.00, true),
  ('l4_leader',    'L4-Leader',    4,  6,  25000,  0, 1000000,  false, 2, 0.00, true),
  ('l5_director',  'L5-Director',  5,  7,  25000,  0, 2500000,  false, 3, 0.00, true),
  ('l6_icon',      'L6-Icon',      6,  8,  25000,  0, 5000000,  false, 4, 0.00, true)
ON CONFLICT (rank_code) DO UPDATE SET
  rank_name = EXCLUDED.rank_name,
  rank_order = EXCLUDED.rank_order,
  min_active_customers = EXCLUDED.min_active_customers,
  min_personal_order_cv_cents = EXCLUDED.min_personal_order_cv_cents,
  min_team_volume_cents = EXCLUDED.min_team_volume_cents,
  requires_active_subscription = EXCLUDED.requires_active_subscription,
  unlocked_generations = EXCLUDED.unlocked_generations,
  is_active = true,
  updated_at = now();

-- 5c. Update store settings to v1.3 values
INSERT INTO public.store_settings (key, value, description) VALUES
  ('cv_to_retail_ratio',  '0.5',     'Commissionable Volume = Retail × 0.5'),
  ('plan_version',        '"v1.3"',  'Active comp plan version')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

UPDATE public.store_settings
SET value = '7'::JSONB, description = 'Days to hold commissions before release (v1.3)', updated_at = now()
WHERE key = 'commission_hold_days';

-- 5d. Insert v1.3 commission config version
INSERT INTO public.commission_config_versions (
  version_code, effective_start_date,
  -- Legacy fields kept at zero/null so they don't influence v1.3 calcs
  commissionable_rate, fast_start_l1_pct, fast_start_l2_pct, fast_start_l3_pct,
  generation_g1_pct, generation_g2_pct, generation_g3_pct, generation_g4_pct, generation_g5_pct,
  direct_bonus_enabled, direct_bonus_tier1_pct, direct_bonus_tier2_pct,
  personal_sub_enabled, personal_sub_pct,
  customer_commission_enabled,
  -- v1.3 fields
  cv_to_retail_ratio, commission_hold_days, min_payout_cents, max_total_payout_pct,
  l1_tier1_rate, l1_tier1_ceiling_cents,
  l1_tier2_rate, l1_tier2_ceiling_cents,
  l1_tier3_rate, l1_tier3_ceiling_cents,
  l1_tier4_rate,
  standard_l2_rate, standard_l3_rate, standard_l4_rate,
  elite_l2_rate,    elite_l3_rate,    elite_l4_rate,
  elite_qualify_min_enrollments, elite_qualify_pack_cents, elite_qualify_min_group_cv_cents, elite_qualify_bonus_cents,
  elite_maint_min_active_customers, elite_maint_min_group_cv_cents, elite_maint_min_personal_order_cv_cents,
  generation_enabled, generation_rate, generation_max_count, generation_threshold_rank,
  generation_compression_enabled, generation_pool_cap_pct,
  milestone_enabled,
  milestone_bronze_threshold_cents, milestone_bronze_bonus_cents,
  milestone_silver_threshold_cents, milestone_silver_bonus_cents,
  milestone_gold_threshold_cents,   milestone_gold_bonus_cents,
  milestone_stacking_enabled,
  fast_start_enabled, fast_start_pool_pct, fast_start_qualifying_window_days, fast_start_min_enrollments,
  refund_clawback_enabled, active_affiliate_rule_enabled, fraud_hold_blocks_payout,
  change_notes
) VALUES (
  'v1.3', CURRENT_DATE,
  -- Legacy fields zeroed
  0.00, 0.00, 0.00, 0.00,
  0.00, 0.00, 0.00, 0.00, 0.00,
  false, 0.00, 0.00,
  false, 0.00,
  false,
  -- v1.3 globals
  0.5, 7, 5000, 0.45,
  -- Tiered L1
  0.30, 500000,
  0.35, 1000000,
  0.40, 2500000,
  0.45,
  -- Standard L2-L4
  0.10, 0.05, 0.02,
  -- Elite L2-L4
  0.12, 0.06, 0.02,
  -- Elite qualification
  5, 50000, 200000, 10000,
  -- Elite maintenance
  5, 200000, 12500,
  -- Generations
  true, 0.04, 4, 'l3_promoter', true, 0.20,
  -- Milestones
  true,
  500000,  25000,
  1000000, 100000,
  2500000, 300000,
  true,
  -- Fast Start
  true, 0.02, 60, 1,
  -- Guardrails
  true, true, true,
  'XO Pure v1.3: tiered L1 (30/35/40/45 at $5K/$10K/$25K), Standard vs Elite L2-L4 (10/5/2 vs 12/6/2), 4-gen dynamic compression at 4%, Bronze/Silver/Gold milestones ($250/$1K/$3K), 2% Fast Start pool, 7-day hold'
)
ON CONFLICT (version_code) DO UPDATE SET
  effective_start_date = EXCLUDED.effective_start_date,
  l1_tier1_rate = EXCLUDED.l1_tier1_rate,
  l1_tier1_ceiling_cents = EXCLUDED.l1_tier1_ceiling_cents,
  l1_tier2_rate = EXCLUDED.l1_tier2_rate,
  l1_tier2_ceiling_cents = EXCLUDED.l1_tier2_ceiling_cents,
  l1_tier3_rate = EXCLUDED.l1_tier3_rate,
  l1_tier3_ceiling_cents = EXCLUDED.l1_tier3_ceiling_cents,
  l1_tier4_rate = EXCLUDED.l1_tier4_rate,
  standard_l2_rate = EXCLUDED.standard_l2_rate,
  standard_l3_rate = EXCLUDED.standard_l3_rate,
  standard_l4_rate = EXCLUDED.standard_l4_rate,
  elite_l2_rate = EXCLUDED.elite_l2_rate,
  elite_l3_rate = EXCLUDED.elite_l3_rate,
  elite_l4_rate = EXCLUDED.elite_l4_rate,
  generation_rate = EXCLUDED.generation_rate,
  generation_max_count = EXCLUDED.generation_max_count,
  milestone_bronze_threshold_cents = EXCLUDED.milestone_bronze_threshold_cents,
  milestone_bronze_bonus_cents = EXCLUDED.milestone_bronze_bonus_cents,
  milestone_silver_threshold_cents = EXCLUDED.milestone_silver_threshold_cents,
  milestone_silver_bonus_cents = EXCLUDED.milestone_silver_bonus_cents,
  milestone_gold_threshold_cents = EXCLUDED.milestone_gold_threshold_cents,
  milestone_gold_bonus_cents = EXCLUDED.milestone_gold_bonus_cents,
  fast_start_pool_pct = EXCLUDED.fast_start_pool_pct,
  commission_hold_days = EXCLUDED.commission_hold_days,
  cv_to_retail_ratio = EXCLUDED.cv_to_retail_ratio,
  change_notes = EXCLUDED.change_notes,
  updated_at = now();

-- 5e. Close out any previously-active config versions (set effective_end_date to yesterday)
UPDATE public.commission_config_versions
SET effective_end_date = CURRENT_DATE - 1
WHERE version_code IS DISTINCT FROM 'v1.3'
  AND effective_end_date IS NULL
  AND effective_start_date < CURRENT_DATE;


-- =============================================================================
-- SECTION 6: VERIFICATION QUERIES
-- Run these after the migration to confirm everything is correct.
-- =============================================================================

-- 6a. Verify v1.3 config is active and rates are correct
-- SELECT version_code,
--        l1_tier1_rate, l1_tier2_rate, l1_tier3_rate, l1_tier4_rate,
--        standard_l2_rate, elite_l2_rate,
--        generation_rate, generation_max_count,
--        milestone_bronze_bonus_cents / 100.0 AS bronze_dollars,
--        commission_hold_days
-- FROM public.commission_config_versions
-- WHERE effective_end_date IS NULL OR effective_end_date >= CURRENT_DATE
-- ORDER BY effective_start_date DESC LIMIT 1;

-- 6b. Verify v1.3 ranks are active
-- SELECT rank_code, rank_name, rank_order, is_active,
--        min_active_customers,
--        min_personal_order_cv_cents / 100.0 AS min_po_dollars,
--        min_team_volume_cents / 100.0 AS min_gv_dollars,
--        unlocked_generations
-- FROM public.rank_definitions
-- WHERE is_active = true
-- ORDER BY rank_order;

-- 6c. Test the tiered L1 waterfall at known points
-- SELECT
--   public.calc_tiered_l1_commission(500000)  / 100.0 AS at_5k_dollars,    -- expect 1500.00
--   public.calc_tiered_l1_commission(1000000) / 100.0 AS at_10k_dollars,   -- expect 3250.00
--   public.calc_tiered_l1_commission(2500000) / 100.0 AS at_25k_dollars,   -- expect 9250.00
--   public.calc_tiered_l1_commission(3000000) / 100.0 AS at_30k_dollars;   -- expect 11500.00

-- 6d. Test milestone bonuses
-- SELECT * FROM public.calc_milestone_bonuses(500000);   -- bronze=$250
-- SELECT * FROM public.calc_milestone_bonuses(1000000);  -- bronze+silver=$1250
-- SELECT * FROM public.calc_milestone_bonuses(2500000);  -- all three=$4250

-- 6e. Test L1 tier classification
-- SELECT
--   public.get_l1_tier(400000)  AS at_4k,    -- expect 1
--   public.get_l1_tier(600000)  AS at_6k,    -- expect 2
--   public.get_l1_tier(1200000) AS at_12k,   -- expect 3
--   public.get_l1_tier(3000000) AS at_30k;   -- expect 4

-- 6f. Test marginal rate (what % the next sale earns)
-- SELECT
--   public.get_marginal_l1_rate(400000)  AS next_sale_at_4k,    -- expect 0.30
--   public.get_marginal_l1_rate(7500000) AS next_sale_at_75k;   -- expect 0.45


-- =============================================================================
-- DONE.
--
-- Post-migration checklist:
--
--   1. Run the verification queries in SECTION 6 to confirm rates and ranks.
--
--   2. Update commission engine code (if any exists in your app) to:
--      - Use calc_tiered_l1_commission() instead of single-rate L1 logic
--      - Use Standard vs Elite L2-L4 rates based on get_effective_path()
--      - Pay 4% × up to 4 generations using find_next_qualified_upline() for compression
--      - Add Bronze/Silver/Gold milestone bonus checks at end-of-period
--      - Pool Fast Start as 2% of period CV instead of level-based percentages
--
--   3. Refresh materialized views:
--      REFRESH MATERIALIZED VIEW public.mv_affiliate_performance;
--      REFRESH MATERIALIZED VIEW public.mv_product_performance;
--      REFRESH MATERIALIZED VIEW public.mv_commission_plan_effectiveness;
--
--   4. Re-run any rank evaluation for existing affiliates against new thresholds:
--      UPDATE public.affiliates a
--      SET paid_as_rank = (
--        SELECT rank_code FROM public.evaluate_affiliate_rank_v13(
--          a.active_customer_count,
--          a.personal_order_cv_cents,
--          a.team_volume_cents
--        )
--      )
--      WHERE a.status = 'approved';
--
-- =============================================================================