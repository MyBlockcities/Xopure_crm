## Table `affiliate_attributions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `order_id` | `uuid` |  |
| `affiliate_id` | `uuid` |  |
| `chain_snapshot` | `jsonb` |  |
| `plan_snapshot` | `jsonb` |  |
| `tracking_code` | `varchar` |  |
| `created_at` | `timestamptz` |  |

## Table `affiliate_click_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `affiliate_id` | `uuid` |  |
| `tracking_code` | `varchar` |  |
| `page_url` | `text` |  |
| `referrer` | `text` |  Nullable |
| `ip_address` | `inet` |  Nullable |
| `user_agent` | `text` |  Nullable |
| `fingerprint` | `varchar` |  Nullable |
| `is_suspicious` | `bool` |  |
| `metadata` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `affiliate_clicks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `affiliate_id` | `uuid` |  |
| `page_url` | `text` |  |
| `referrer` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `affiliate_payouts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `affiliate_id` | `uuid` |  |
| `order_id` | `uuid` |  |
| `level` | `int2` |  |
| `amount_cents` | `int4` |  |
| `status` | `varchar` |  |
| `paid_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `affiliates`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `email` | `varchar` |  Unique |
| `name` | `varchar` |  |
| `tracking_code` | `varchar` |  Unique |
| `parent_id` | `uuid` |  Nullable |
| `commission_plan_id` | `uuid` |  Nullable |
| `payout_details` | `jsonb` |  Nullable |
| `status` | `varchar` |  |
| `social_handle` | `text` |  Nullable |
| `audience_size` | `text` |  Nullable |
| `reason` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `rank` | `text` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |
| `account_type` | `text` |  Nullable |
| `ambassador_conversion_date` | `timestamptz` |  Nullable |
| `active_customer_count` | `int4` |  Nullable |
| `personal_volume_cents` | `int4` |  Nullable |
| `team_volume_cents` | `int4` |  Nullable |
| `career_rank` | `text` |  Nullable |
| `paid_as_rank` | `text` |  Nullable |

## Table `commission_config_versions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `effective_start_date` | `date` |  |
| `effective_end_date` | `date` |  Nullable |
| `commissionable_rate` | `numeric` |  |
| `commission_hold_days` | `int4` |  |
| `min_payout_cents` | `int4` |  |
| `max_total_payout_pct` | `numeric` |  |
| `active_affiliate_rule_enabled` | `bool` |  |
| `refund_clawback_enabled` | `bool` |  |
| `compression_enabled` | `bool` |  |
| `fast_start_enabled` | `bool` |  |
| `fast_start_l1_pct` | `numeric` |  |
| `fast_start_l2_pct` | `numeric` |  |
| `fast_start_l3_pct` | `numeric` |  |
| `fast_start_compression_mode` | `text` |  |
| `generation_enabled` | `bool` |  |
| `generation_g1_pct` | `numeric` |  |
| `generation_g2_pct` | `numeric` |  |
| `generation_g3_pct` | `numeric` |  |
| `generation_g4_pct` | `numeric` |  |
| `generation_g5_pct` | `numeric` |  |
| `generation_pool_cap_pct` | `numeric` |  |
| `generation_threshold_rank` | `text` |  |
| `generation_compression_mode` | `text` |  |
| `direct_bonus_enabled` | `bool` |  |
| `direct_bonus_tier1_pct` | `numeric` |  |
| `direct_bonus_tier1_volume_cents` | `int4` |  |
| `direct_bonus_tier2_pct` | `numeric` |  |
| `direct_bonus_tier2_volume_cents` | `int4` |  |
| `direct_bonus_tier_mode` | `text` |  |
| `direct_bonus_volume_basis` | `text` |  |
| `customer_commission_enabled` | `bool` |  |
| `customer_commission_compression_mode` | `text` |  |
| `customer_commission_eligible_event_types` | `_text` |  |
| `personal_sub_enabled` | `bool` |  |
| `personal_sub_pct` | `numeric` |  |
| `personal_sub_min_customers` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `commission_ledger`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `order_id` | `uuid` |  Nullable |
| `order_item_id` | `uuid` |  Nullable |
| `attribution_id` | `uuid` |  Nullable |
| `affiliate_id` | `uuid` |  |
| `level` | `int2` |  Nullable |
| `percentage_bps` | `int4` |  Nullable |
| `amount_cents` | `int4` |  |
| `status` | `varchar` |  |
| `hold_until` | `timestamptz` |  Nullable |
| `paid_at` | `timestamptz` |  Nullable |
| `batch_id` | `uuid` |  Nullable |
| `plan_snapshot_json` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `pay_area` | `text` |  Nullable |
| `explanation` | `text` |  Nullable |
| `calculation_trace_json` | `jsonb` |  Nullable |
| `compressed_from_id` | `uuid` |  Nullable |
| `compression_reason` | `text` |  Nullable |
| `config_version_id` | `uuid` |  Nullable |
| `source_affiliate_id` | `uuid` |  Nullable |
| `base_cv_amount` | `int4` |  Nullable |
| `rate_used` | `numeric` |  Nullable |
| `period_id` | `text` |  Nullable |

## Table `commission_periods`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `period_id` | `text` |  Unique |
| `status` | `text` |  |
| `config_version_id` | `uuid` |  Nullable |
| `total_eligible_cv_cents` | `int8` |  Nullable |
| `total_generation_cv_cents` | `int8` |  Nullable |
| `generation_scale_factor` | `numeric` |  Nullable |
| `started_at` | `timestamptz` |  Nullable |
| `completed_at` | `timestamptz` |  Nullable |
| `error_message` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `commission_plans`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `varchar` |  |
| `tiers_enabled` | `int2` |  |
| `tier_percentages` | `_numeric` |  |
| `scope` | `varchar` |  |
| `scope_ref` | `uuid` |  Nullable |
| `is_default` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `launch_bonus_cents` | `int4` |  Nullable |
| `global_bonus_pool_pct` | `numeric` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |

## Table `crm_sync_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `source_system` | `text` |  |
| `source_schema` | `text` |  |
| `source_table` | `text` |  |
| `source_id` | `text` |  Nullable |
| `operation` | `text` |  |
| `target_object` | `text` |  Nullable |
| `target_record_id` | `text` |  Nullable |
| `payload` | `jsonb` |  |
| `status` | `text` |  |
| `error_message` | `text` |  Nullable |
| `attempts` | `int4` |  |
| `processed_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `crm_sync_map`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `source_system` | `text` |  |
| `source_schema` | `text` |  |
| `source_table` | `text` |  |
| `source_id` | `text` |  |
| `twenty_object` | `text` |  |
| `twenty_record_id` | `text` |  Nullable |
| `sync_direction` | `text` |  |
| `content_hash` | `text` |  Nullable |
| `last_payload` | `jsonb` |  Nullable |
| `last_written_by` | `text` |  Nullable |
| `last_synced_at` | `timestamptz` |  Nullable |
| `last_error` | `text` |  Nullable |
| `retry_count` | `int4` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `customer_expertise`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_id` | `uuid` |  Unique |
| `expertise_data` | `jsonb` |  |
| `recommendation_cache` | `jsonb` |  Nullable |
| `drip_state` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `total_interactions` | `int4` |  |
| `last_interaction_at` | `timestamptz` |  Nullable |

## Table `discount_codes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `code` | `varchar` |  Unique |
| `type` | `varchar` |  |
| `value` | `int4` |  |
| `min_order_cents` | `int4` |  Nullable |
| `max_uses` | `int4` |  Nullable |
| `current_uses` | `int4` |  |
| `affiliate_id` | `uuid` |  Nullable |
| `expires_at` | `timestamptz` |  Nullable |
| `active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `fraud_reviews`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `order_id` | `uuid` |  Nullable |
| `affiliate_id` | `uuid` |  Nullable |
| `review_type` | `varchar` |  |
| `evidence` | `jsonb` |  |
| `status` | `varchar` |  |
| `reviewed_by` | `uuid` |  Nullable |
| `reviewed_at` | `timestamptz` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `influencer_prospects`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `email` | `text` |  Nullable |
| `name` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `platform` | `text` |  Nullable |
| `handle` | `text` |  Nullable |
| `profile_url` | `text` |  Nullable |
| `niche` | `text` |  Nullable |
| `follower_count` | `int4` |  Nullable |
| `engagement_rate` | `numeric` |  Nullable |
| `media_kit_url` | `text` |  Nullable |
| `source` | `text` |  |
| `stage` | `text` |  |
| `status` | `text` |  |
| `lead_score` | `int4` |  |
| `tags` | `_text` |  |
| `social_handles` | `jsonb` |  |
| `enrichment_status` | `text` |  |
| `enrichment_data` | `jsonb` |  |
| `sequence_key` | `text` |  Nullable |
| `sequence_state` | `jsonb` |  |
| `last_contacted_at` | `timestamptz` |  Nullable |
| `assigned_to` | `uuid` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `order_items`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `order_id` | `uuid` |  |
| `product_id` | `uuid` |  Nullable |
| `sku` | `varchar` |  |
| `name` | `varchar` |  |
| `unit_price_cents` | `int4` |  |
| `quantity` | `int4` |  |
| `line_total_cents` | `int4` |  |
| `category` | `varchar` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `cv_amount` | `int4` |  Nullable |

## Table `orders`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_email` | `varchar` |  |
| `subtotal_cents` | `int4` |  |
| `currency` | `varchar` |  |
| `affiliate_chain` | `_uuid` |  Nullable |
| `commission_plan_id` | `uuid` |  Nullable |
| `commission_amounts` | `_int4` |  Nullable |
| `payment_gateway` | `varchar` |  |
| `payment_status` | `varchar` |  |
| `gateway_payload` | `jsonb` |  Nullable |
| `shipping_address` | `jsonb` |  Nullable |
| `items` | `jsonb` |  |
| `created_at` | `timestamptz` |  |
| `customer_id` | `uuid` |  Nullable |
| `discount_code_id` | `uuid` |  Nullable |
| `discount_amount_cents` | `int4` |  Nullable |
| `shipping_cents` | `int4` |  Nullable |
| `tax_cents` | `int4` |  Nullable |
| `total_cents` | `int4` |  Nullable |
| `updated_at` | `timestamptz` |  Nullable |
| `refund_amount_cents` | `int4` |  Nullable |
| `event_type` | `text` |  Nullable |
| `cv_amount` | `int4` |  Nullable |
| `buyer_type` | `text` |  Nullable |

## Table `payment_events`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `order_id` | `uuid` |  Nullable |
| `gateway` | `varchar` |  |
| `gateway_event_id` | `varchar` |  |
| `event_type` | `varchar` |  |
| `payload` | `jsonb` |  |
| `processed` | `bool` |  |
| `processed_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `period_snapshots`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `period_id` | `text` |  |
| `affiliate_id` | `uuid` |  |
| `sponsor_id` | `uuid` |  Nullable |
| `paid_as_rank` | `text` |  |
| `career_rank` | `text` |  |
| `active_flag` | `bool` |  |
| `active_customer_count` | `int4` |  |
| `personal_volume_cents` | `int8` |  |
| `team_volume_cents` | `int8` |  |
| `customer_ownership` | `jsonb` |  Nullable |
| `genealogy_path` | `_uuid` |  Nullable |
| `unlocked_generations` | `int4` |  |
| `active_subscription_flag` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `products`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `sku` | `varchar` |  Unique |
| `name` | `varchar` |  |
| `description` | `text` |  Nullable |
| `price_cents` | `int4` |  |
| `currency` | `varchar` |  |
| `image_url` | `text` |  Nullable |
| `category` | `varchar` |  Nullable |
| `active` | `bool` |  |
| `metadata` | `jsonb` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `stock_quantity` | `int4` |  Nullable |
| `slug` | `text` |  Nullable Unique |
| `pre_order` | `bool` |  Nullable |
| `featured` | `bool` |  Nullable |
| `product_url` | `text` |  Nullable |
| `sheet_row_id` | `text` |  Nullable |
| `synced_at` | `timestamptz` |  Nullable |
| `commission_plan_id` | `uuid` |  Nullable |
| `cv_amount` | `int4` |  Nullable |

## Table `quiz_results`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_id` | `uuid` |  Nullable |
| `session_id` | `text` |  Nullable |
| `answers` | `jsonb` |  |
| `recommended_products` | `_uuid` |  Nullable |
| `discount_code_id` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  Nullable |

## Table `rank_definitions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `rank_code` | `text` |  Unique |
| `rank_name` | `text` |  |
| `rank_order` | `int4` |  |
| `min_active_customers` | `int4` |  |
| `min_personal_volume_cents` | `int4` |  |
| `min_team_volume_cents` | `int4` |  |
| `requires_active_subscription` | `bool` |  |
| `unlocked_generations` | `int4` |  |
| `customer_commission_pct` | `numeric` |  |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `retail_prospects`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `email` | `text` |  Nullable |
| `name` | `text` |  Nullable |
| `phone` | `text` |  Nullable |
| `company` | `text` |  Nullable |
| `website` | `text` |  Nullable |
| `source` | `text` |  |
| `stage` | `text` |  |
| `status` | `text` |  |
| `lead_score` | `int4` |  |
| `tags` | `_text` |  |
| `social_handles` | `jsonb` |  |
| `enrichment_status` | `text` |  |
| `enrichment_data` | `jsonb` |  |
| `sequence_key` | `text` |  Nullable |
| `sequence_state` | `jsonb` |  |
| `last_contacted_at` | `timestamptz` |  Nullable |
| `assigned_to` | `uuid` |  Nullable |
| `notes` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `server_carts`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `customer_id` | `uuid` |  Nullable |
| `session_id` | `varchar` |  Nullable |
| `items` | `jsonb` |  |
| `affiliate_code` | `varchar` |  Nullable |
| `status` | `varchar` |  |
| `updated_at` | `timestamptz` |  |
| `created_at` | `timestamptz` |  |

## Table `store_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `key` | `varchar` |  Unique |
| `value` | `jsonb` |  |
| `description` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `sync_logs`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `source` | `varchar` |  |
| `rows_synced` | `int4` |  Nullable |
| `rows_changed` | `int4` |  Nullable |
| `status` | `varchar` |  |
| `duration_ms` | `int4` |  Nullable |
| `error_message` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `user_roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `role` | `app_role` |  |




supabase project 2:

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.affiliate_attributions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_reference text,
  tracking_code character varying NOT NULL,
  chain_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_email character varying,
  subtotal_cents integer,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  checkout_method character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  xo_pure_ambassador_id uuid,
  CONSTRAINT affiliate_attributions_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_attributions_xo_pure_ambassador_fk FOREIGN KEY (xo_pure_ambassador_id) REFERENCES public.xo_pure_ambassadors(id)
);
CREATE TABLE public.affiliate_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tracking_code character varying NOT NULL,
  page_url text NOT NULL DEFAULT '/'::text,
  referrer text,
  ip_address inet,
  user_agent text,
  fingerprint character varying,
  is_suspicious boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  xo_pure_ambassador_id uuid,
  CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_clicks_xo_pure_ambassador_fk FOREIGN KEY (xo_pure_ambassador_id) REFERENCES public.xo_pure_ambassadors(id)
);
CREATE TABLE public.integration_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key character varying NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT integration_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.outbound_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type character varying NOT NULL,
  source_id uuid,
  payload jsonb NOT NULL,
  target_url text,
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  pg_net_request_id bigint,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT outbound_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.restock_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  product_name text NOT NULL,
  variant text,
  email character varying NOT NULL,
  tracking_code character varying,
  user_agent text,
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restock_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.xo_pure_ambassadors (
  id uuid NOT NULL,
  user_id uuid,
  tracking_code character varying NOT NULL UNIQUE,
  name text,
  email character varying,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  rank text,
  parent_id uuid,
  commission_plan_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source_project_ref text NOT NULL DEFAULT 'rahyvpnjpkgukepefrur'::text,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  raw_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT xo_pure_ambassadors_pkey PRIMARY KEY (id),
  CONSTRAINT xo_pure_ambassadors_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.xo_pure_ambassadors(id)
);


You are looking at **two very different database shapes**:

1. **The schema you pasted in the message** = a **small XO Pure sync / attribution / integration database**
2. **The uploaded schema** = a much larger **full commerce + affiliate + commission + CRM operating database** with orders, products, commission ledgers, periods, prospects, fraud review, checkout, and customer intelligence tables. 

## Biggest difference

The pasted schema is **not a complete business database**. It looks like a **thin bridge layer** that tracks ambassadors, clicks, attributions, outbound events, restock requests, settings, and roles.

The uploaded schema is the **real operational system**. It includes the full affiliate program, checkout/store logic, commission engine, CRM sync, prospecting, fraud review, product catalog, payment events, carts, and rank/period logic. 

---

# 1. Ambassador table difference

## Pasted schema

Your pasted schema uses:

```sql
xo_pure_ambassadors
```

This table has:

```sql
id
user_id
tracking_code
name
email
status
rank
parent_id
commission_plan_id
source_project_ref
synced_at
raw_snapshot
```

This feels like a **synced copy of ambassadors from another Supabase project**. The key clues are:

```sql
source_project_ref
synced_at
raw_snapshot
```

That means this table is probably not the original master affiliate table. It is storing ambassador records imported or mirrored from somewhere else.

## Uploaded schema

The uploaded schema uses:

```sql
affiliates
```

This is much richer. It includes:

```sql
payout_details
social_handle
audience_size
reason
account_type
ambassador_conversion_date
active_customer_count
personal_volume_cents
team_volume_cents
career_rank
paid_as_rank
```

That means the uploaded schema is designed for **real ambassador lifecycle management**, qualification, ranks, payouts, customer counts, and business metrics. 

## Translation

`xo_pure_ambassadors` = lightweight synced ambassador identity table.
`affiliates` = full master affiliate / ambassador business table.

---

# 2. Click tracking difference

## Pasted schema

You have:

```sql
affiliate_clicks
```

with:

```sql
tracking_code
page_url
referrer
ip_address
user_agent
fingerprint
is_suspicious
metadata
xo_pure_ambassador_id
```

This is actually a pretty solid tracking table. It tracks fraud signals, fingerprinting, user agent, IP, and ambassador reference.

## Uploaded schema

The uploaded schema has two click-related tables:

```sql
affiliate_clicks
affiliate_click_events
```

The simpler `affiliate_clicks` has only:

```sql
affiliate_id
page_url
referrer
created_at
```

But `affiliate_click_events` has the richer tracking fields:

```sql
tracking_code
page_url
referrer
ip_address
user_agent
fingerprint
is_suspicious
metadata
created_at
```

So your pasted schema basically looks like it **collapsed the richer click-events model into one `affiliate_clicks` table**. 

## Recommendation

Keep the richer event-style structure, but standardize the naming. I would use:

```sql
affiliate_click_events
```

for raw click tracking, not `affiliate_clicks`, because “events” makes it clear this is append-only analytics data.

---

# 3. Attribution difference

## Pasted schema

Your pasted `affiliate_attributions` has:

```sql
order_id
external_reference
tracking_code
chain_snapshot
plan_snapshot
customer_email
subtotal_cents
items
checkout_method
xo_pure_ambassador_id
```

This is built to capture **checkout attribution even when the order may live somewhere else**.

Important clues:

```sql
external_reference
customer_email
subtotal_cents
items
checkout_method
```

That means it can attribute orders from Shopify, manual checkout, Cash App, Venmo, external storefronts, or another project.

## Uploaded schema

The uploaded `affiliate_attributions` is simpler:

```sql
order_id
affiliate_id
chain_snapshot
plan_snapshot
tracking_code
created_at
```

That version assumes there is already a real `orders` table in the same database. 

## Translation

Pasted version = better for **cross-system attribution**.
Uploaded version = better for **single-database native checkout attribution**.

For XO Pure, because you have multiple storefronts/domains/referral paths, the pasted version’s extra fields are useful.

---

# 4. Commission system difference

This is the biggest missing piece.

## Pasted schema

The pasted schema has **no real commission engine**.

It has:

```sql
commission_plan_id
plan_snapshot
chain_snapshot
```

But it does **not** include:

```sql
commission_ledger
commission_periods
commission_config_versions
period_snapshots
rank_definitions
affiliate_payouts
```

So the pasted database can capture who referred whom and what order happened, but it cannot fully calculate, hold, audit, batch, pay, claw back, or explain commissions.

## Uploaded schema

The uploaded schema has a serious commission engine:

```sql
commission_config_versions
commission_ledger
commission_periods
commission_plans
period_snapshots
rank_definitions
affiliate_payouts
```

The `commission_ledger` is especially important because it stores payout rows with `amount_cents`, `status`, `hold_until`, `paid_at`, `pay_area`, `explanation`, `calculation_trace_json`, `compression_reason`, `config_version_id`, `base_cv_amount`, `rate_used`, and `period_id`. 

## Translation

Pasted schema = attribution layer.
Uploaded schema = commission calculation + audit + payout system.

For XO Pure, you absolutely need the uploaded-style commission ledger if ambassadors are getting paid.

---

# 5. Store / checkout difference

## Pasted schema

The pasted schema does **not** have native store tables like:

```sql
orders
order_items
products
payment_events
discount_codes
server_carts
store_settings
quiz_results
```

It only has attribution, clicks, restock requests, and integration settings.

## Uploaded schema

The uploaded schema has a full e-commerce layer:

```sql
orders
order_items
products
payment_events
discount_codes
server_carts
store_settings
quiz_results
```

The `orders` table includes payment status, gateway payload, shipping, tax, discount, refund amount, CV amount, event type, and buyer type. 

## Translation

Pasted schema = can attach to a checkout elsewhere.
Uploaded schema = can run the store itself.

---

# 6. CRM / Twenty sync difference

## Pasted schema

The pasted schema has:

```sql
outbound_events
integration_settings
```

This supports generic integrations, webhooks, and outbound delivery.

## Uploaded schema

The uploaded schema has dedicated CRM sync infrastructure:

```sql
crm_sync_events
crm_sync_map
sync_logs
```

These are much more specific. They can track:

```sql
source_system
source_schema
source_table
source_id
target_object
target_record_id
twenty_object
twenty_record_id
sync_direction
content_hash
last_payload
last_written_by
last_synced_at
last_error
retry_count
```

That is much better for syncing with Twenty CRM because it can prevent duplicates, track failures, and remember which Supabase record maps to which Twenty record.

## Translation

Pasted schema = generic webhook/event outbox.
Uploaded schema = proper CRM synchronization layer.

For Twenty CRM, you want the uploaded-style `crm_sync_map` and `crm_sync_events`.

---

# 7. Prospecting / growth system difference

The pasted schema has no prospecting system.

The uploaded schema includes:

```sql
influencer_prospects
retail_prospects
```

These are important for XO Pure because they support:

```sql
lead_score
stage
status
tags
social_handles
enrichment_status
enrichment_data
sequence_key
sequence_state
last_contacted_at
assigned_to
notes
```

That means the uploaded database is designed not just to manage existing ambassadors, but to **find, enrich, score, contact, and convert new ambassadors / retail partners**.

---

# 8. User roles difference

Both schemas have:

```sql
user_roles
```

But there is a type difference.

## Pasted schema

```sql
role USER-DEFINED NOT NULL
```

with a foreign key to:

```sql
auth.users(id)
```

## Uploaded schema

```sql
role app_role
```

The uploaded schema excerpt does not show the same foreign key detail, while the pasted one explicitly references Supabase auth users.

## Recommendation

Use one enum consistently. For Supabase, something like this is fine:

```sql
app_role
```

with values like:

```sql
admin
staff
ambassador
customer
finance
support
```

And keep the foreign key to `auth.users(id)` if this database owns login/auth.

---

# 9. Naming mismatch problem

You currently have naming drift:

| Concept       | Pasted schema           | Uploaded schema                                 |
| ------------- | ----------------------- | ----------------------------------------------- |
| Ambassador    | `xo_pure_ambassadors`   | `affiliates`                                    |
| Click events  | `affiliate_clicks`      | `affiliate_click_events` and `affiliate_clicks` |
| Ambassador FK | `xo_pure_ambassador_id` | `affiliate_id`                                  |
| Settings      | `integration_settings`  | `store_settings`                                |
| Outbound sync | `outbound_events`       | `crm_sync_events`, `crm_sync_map`, `sync_logs`  |

This matters because your code, Twenty sync, commission engine, and admin dashboard can easily start pointing at different versions of the same concept.

My recommendation: use **one canonical internal language**:

```txt
Ambassador-facing brand term: Ambassador
Database term: affiliate
Main table: affiliates
Foreign key: affiliate_id
Display copy: ambassador
```

So the UI can say “Ambassador,” but the database can consistently use `affiliates`.

---

# 10. What each database is best for

## Pasted schema is best for:

* Referral tracking
* External checkout attribution
* Ambassador sync from another Supabase project
* Lightweight webhook integration
* Restock requests
* Basic admin/user role control
* Cross-domain tracking from XO Pure storefronts

## Uploaded schema is best for:

* Running the actual storefront
* Product catalog
* Orders and order items
* Discount codes
* Payment events
* Commission calculations
* Commission periods
* Rank qualification
* Fraud review
* Payout tracking
* Twenty CRM sync
* Influencer and retail prospecting
* Customer quiz/product recommendation logic

---

# My blunt read

The pasted schema looks like a **bridge database** or **newer narrowed Supabase project** created to connect XO Pure referrals/ambassadors across systems.

The uploaded schema looks like the **real full XO Pure operating database**.

Do **not** replace the uploaded schema with the pasted one. The pasted one is missing too much.

The best path is to merge them intelligently:

```txt
Use uploaded schema as the master operating database.
Add the useful pasted-schema fields for cross-system attribution/sync.
Standardize ambassadors as affiliates internally.
Keep xo_pure_ambassadors only if it is a temporary mirror/staging table.
```

# Best final architecture

I would structure it like this:

```txt
affiliates
  = master ambassador records

affiliate_click_events
  = raw referral/click tracking

affiliate_attributions
  = checkout attribution, enriched with external_reference, customer_email, subtotal_cents, items, checkout_method

orders + order_items
  = actual store transactions

commission_ledger
  = source of truth for every payable commission

commission_periods + period_snapshots
  = monthly/weekly payout cycle audit

commission_config_versions
  = versioned comp plan rules

rank_definitions
  = rank qualification rules

crm_sync_map + crm_sync_events
  = Twenty CRM synchronization

outbound_events
  = generic webhook/event outbox for Shopify, Twenty, email, agents, etc.

integration_settings / store_settings
  = merge into one settings table unless you need separation
```

# Most important action item

Before writing more migrations, decide this:

```txt
Is xo_pure_ambassadors the new master table, or is it only a synced mirror of affiliates?
```

My recommendation: **do not make `xo_pure_ambassadors` the master.** Make `affiliates` the master, because the larger schema already has commissions, ranks, orders, and payouts connected to `affiliate_id`. Then, if needed, keep `xo_pure_ambassadors` as a temporary staging/sync table until all records are migrated.
