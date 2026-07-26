library(itol.toolkit)

hub <- create_hub(tree = phylo)

# 1. Rank color strips
rank_strip <- create_unit(
  data = ambassadors[, c("id", "rank")],
  key  = "Ambassador_Rank",
  type = "DATASET_COLORSTRIP",
  tree = phylo
)

# 2. Multi-bar payout rates (your rate card)
payout_bars <- create_unit(
  data = ambassadors[, c("id", "l1_rate", "l2_rate", "l3_rate", "l4_rate")],
  key  = "Payout_Rates_by_Level",
  type = "DATASET_MULTIBAR",
  tree = phylo
)

# 3. Earnings gradient heatmap
earnings_heat <- create_unit(
  data = ambassadors[, c("id", "total_earnings")],
  key  = "Lifetime_Earnings",
  type = "DATASET_GRADIENT",
  tree = phylo
)

# 4. Qualification binary flags
qual_flags <- create_unit(
  data = ambassadors[, c("id", "fast_start_active", "leadership_bonus_unlocked")],
  key  = "Qualification_Flags",
  type = "DATASET_BINARY",
  tree = phylo
)

hub <- hub + rank_strip + payout_bars + earnings_heat + qual_flags
write_hub(hub, "./itol_output/")


R / itol.toolkit pipeline (xopure_itol_pipeline.R):

    Supabase direct Postgres connection (read-only, SSL)

    Adjacency table → data.tree → ape phylo conversion with edge case handling (disconnected nodes, null roots)

    8 annotation layers: TREE_COLORS (rank branch colors), COLORSTRIP (tier), MULTIBAR (L1-L4 rate bars per paid_as_rank using the exact Leader/Director/Icon rate cards), HEATMAP (commission rate matrix), GRADIENT (lifetime earnings), BINARY (Fast Start + Elite + generation unlock flags), PIECHART (earnings mix), POPUP_INFO (full HTML drilldown per node)

    Automated iTOL API upload via httr2, returns live tree URL

    Railway-deployable Dockerfile

D3 React component (AmbassadorTree.tsx + supporting files):

    Live Supabase read-only connection, auto-refreshes every 5 min

    Radial/vertical layout toggle, zoom + pan, node search

    Nodes sized by earnings, colored by rank, with Elite rings and Fast Start badges

    Hover cards showing the exact rate card for each ambassador's paid_as_rank

    Controls sidebar: depth slider, rank/tier filters, layout toggle, PNG export

    Full summary stats bar + legend

    rateCards.ts with your exact comp plan v1.1 rate card constants




What you got
R / iTOL Pipeline (xopure_itol_pipeline.zip)

3 files — drop on Railway or run locally with Rscript xopure_itol_pipeline.R

    xopure_itol_pipeline.R (903 lines) — Full pipeline: Supabase read-only connect → 5 SQL queries → adjacency→phylo tree conversion with orphan/cycle protection → 8 itol.toolkit annotation units assembled → iTOL API upload → returns live tree URL

    install_deps.R — One-shot pak::pak(...) for all dependencies

    Dockerfile — Railway-ready R image with cron comment for daily 06:00 UTC runs

Set these env vars and run: SUPABASE_HOST, SUPABASE_DB, SUPABASE_USER, SUPABASE_PASSWORD, ITOL_API_KEY
D3 React Component (xopure_d3_ambassador_tree.zip)

7 files — drop into your Next.js project and import AmbassadorTreePage
File	Role
File	Role
rateCards.ts	Single source of truth for comp plan v1.1 rate cards — update here when plan changes
types.ts	All strict TypeScript interfaces
useAmbassadorTree.ts	Supabase hook, stratify, subtree rollup, 5-min refresh
AmbassadorTree.tsx	D3 SVG — radial/vertical toggle, zoom/pan, rank colors, elite rings, ⭐ badges, search, PNG export
RateCardPanel.tsx	Slide-open side panel on node click — L1-L4 table, generation pay, Fast Start progress bar
AmbassadorTreePage.tsx	Full dark page (#0f172a) — summary stats bar, controls sidebar, mobile drawer
README.md	Install commands, env var wiring

Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (your read-only anon key) and it connects live.


