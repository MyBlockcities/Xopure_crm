# XO Pure Ambassador Compensation Rules Digest

> Governing source: `XO_Pure_Comp_Plan - Final.pdf`, rules locked 2026-05-24.
>
> Approved correction: eligible balances above `$10` are disbursed weekly. The PDF page-6
> `$50` minimum-payout row is superseded. The Friday sweep flow on page 9 and this correction
> govern implementation.

## Non-Negotiable Data Rule

- Supabase is read-only from this repository and from Codex.
- Never apply migrations, execute mutating SQL, invoke write RPCs, update rows, or run scripts
  in a mode that writes to Supabase.
- Reads are allowed for audits and verification only.
- Proposed Supabase changes must remain local review artifacts until Brian handles deployment
  outside this workflow.

## Units

| Term | Governing definition |
|---|---|
| Retail price | Amount the customer pays at checkout |
| CV | Commissionable volume: `50%` of retail |
| PV | Self-orders plus attributed retail/guest sales, measured in CV |
| PCV | PV excluding self-orders, used for FTC reporting |
| GV | Ambassador PV plus recursive downline PV, measured in CV |

Unless stated otherwise, thresholds, rates, and bonuses use CV.

## Earnings

### Customer Commission

Paid weekly on the seller's own customer sales. Tiers reset monthly and are progressive:

| Monthly CV slice | Rate |
|---|---:|
| First `$5,000` | `30%` |
| `$5,001-$10,000` | `35%` |
| `$10,001-$25,000` | `40%` |
| Above `$25,000` | `45%` |

### Milestone Bonuses

One-time lifetime bonuses triggered by monthly GV:

| Milestone | Monthly GV | Bonus |
|---|---:|---:|
| Bronze | `$5,000` | `$250` |
| Silver | `$10,000` | `$1,000` |
| Gold | `$25,000` | `$3,000` |

### Team Pay

| Affiliate type | Requirement | L1 | L2 | L3 | L4 |
|---|---|---:|---:|---:|---:|
| Customer / Referral | No personal order required | `30%` | - | - | - |
| Ordering | Qualifying personal order | `30%` | `10%` | `5%` | `2%` |
| Elite Pack | Elite qualification plus maintenance | `40%` | `15%` | `6%` | `3%` |

Ordering and Elite affiliates unlock levels through personal enrollments: L1 by default,
L2 at `1`, L3 at `2`, and L4 at `4`. Customer / Referral affiliates always earn L1 only.

### Elite Status

First-90-day qualification requires `5` personal enrollments, `$500` personal CV, `$2,000`
GV, and an Elite Pack purchase. Natural qualification earns a `$100` bonus.

During the promotional window, maintenance requires `5` active customers, `$2,000` GV, and
`$250` personal monthly CV. After the 90-day window, monthly Leader-rank maintenance requires
`6` active customers, `$10,000` GV, and `$500` personal CV. Missing a month pays standard
rates for that month only; requalification restores Elite rates without permanent demotion.

### Generation Pay

Generation pay unlocks at Promoter (`R3`) and uses dynamic compression. Each unlocked
generation pays `4%` of CV:

| Rank | Generations |
|---|---|
| Promoter (`R3`) | Gen 1 |
| Leader (`R4`) | Gen 1-2 |
| Director (`R5`) | Gen 1-3 |
| Icon (`R6`) | Gen 1-4 |

### Fast Start Pool

The Fast Start pool is `2%` of total period CV, applies during an ambassador's first `60`
days, uses compression, and is distributed per published period rules.

## Rank Definitions

| Rank | Personal customers | GV | Monthly PV | Generation access |
|---|---:|---:|---:|---|
| Customer (`R0`) | `0` | `$0` | `$0` | - |
| Starter (`R1`) | `1` | Any | `$100` | - |
| Builder (`R2`) | `2` | `$1,000` | `$200` | - |
| Promoter (`R3`) | `4` | `$5,000` | `$250` | Gen 1 |
| Leader (`R4`) | `6` | `$10,000` | `$500` | Gen 1-2 |
| Director (`R5`) | `7` | `$25,000` | `$500` | Gen 1-3 |
| Icon (`R6`) | `8` | `$50,000` | `$500` | Gen 1-4 |

Track `paid_as_rank` for current-period math and `career_rank` for recognition and analytics.

## Payouts, Refunds, And Caps

- Accrue daily as `held`.
- Release to `payable` seven days after payment date.
- Sweep on Friday in `America/New_York`.
- Disburse weekly when the eligible payable total is above `$10`.
- Refunds inside the hold window void commission before release.
- Refunds after release claw back against future balances and may carry a negative balance.
- Total L1-L4 level commissions are capped at `50%` of an order's CV.
- Total Gen 1-4 generation bonuses are capped at `40%` of an order's CV.
- Fast Start pool period cap is `40%`; triggered caps prorate without hard cutoffs.

## Order-Type Rules

| Order type | PV | PCV | GV | Personal customer | Commission |
|---|---|---|---|---|---|
| Self-order | Yes | No | Yes | No | No |
| Retail / guest checkout | Yes | Yes | Yes | Yes | L1 to attributed ambassador |
| Ambassador-to-ambassador purchase | Buyer's PV | No | Up buyer's upline | No | Team pay only; no L1 |

## Calculation Flow

1. Record `affiliate_chain` when the order is placed.
2. Accrue held commission daily after payment confirmation.
3. Run fraud scoring, including self-referral and velocity checks.
4. Move commission to `payable` seven days after payment date.
5. Sweep Friday and pay eligible payable totals above `$10`.
6. At monthly close, evaluate `paid_as_rank`, `career_rank`, and milestone bonuses from
   monthly GV.

