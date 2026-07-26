**\# XO Pure CRM Integration — Developer Guide (\`crm.xopure.com\`)**

**\*\*Audience:\*\*** the developer building the third-party CRM at \`crm.xopure.com\`.  
**\*\*Purpose:\*\*** everything needed to pull orders, shipping, commissions, tickets, and ambassador data out of XO Pure's Supabase and **\*\*display it correctly\*\*** — with the exact comp-plan rules the numbers must obey.  
**\*\*Last verified against production:\*\*** 2026-07-25.

\---

**\#\# 0\. THE READ-ONLY RULE (read this first)**

**\*\*The CRM connects to Supabase with a READ-ONLY role. It must never write.\*\***

\- Use a dedicated read-only Postgres role (e.g. \`crm\_readonly\`) with \`GRANT SELECT\` only — **\*\*no INSERT/UPDATE/DELETE, no service\_role key.\*\*** The service-role key bypasses RLS and can write; it must **\*\*never\*\*** ship in the CRM.  
\- The CRM is a **\*\*mirror\*\***, not a source of truth. Order status, commissions, ranks, shipping — all of it is computed and written by the main XO Pure app \+ its cron jobs. The CRM displays that state; it does not change it.  
\- If the CRM needs to *\*act\** (create a ticket, trigger a re-ship), it must call a **\*\*dedicated XO Pure API endpoint\*\*** (service-role, server-side) — never write to Supabase directly. Those endpoints are listed in §7.  
\- **\*\*RLS is ON\*\*** for \`orders\`, \`affiliates\`, \`commission\_ledger\`, \`support\_tickets\`. A plain read-only role sees only what its policies allow. For a full-visibility admin CRM, either (a) connect as a role whose RLS policies grant broad SELECT, or (b) pull through the XO Pure admin API (§7) which uses the service role behind admin auth. **\*\*Do not disable RLS.\*\***

\---

**\#\# 1\. THE COMP ENGINE — start to finish**

Every order runs through this decision tree. The CRM must understand it to display commissions correctly.

**\#\#\# 1.1 — Classify the order (one of three; this picks the entire model)**  
| \`orders.order\_type\` / \`event\_type\` | CRM label | Model |  
|---|---|---|  
| \`order\_type \= 'wholesale'\` | **\*\*Wholesale\*\*** | 10 / 5 / 5 of subtotal |  
| \`event\_type \= 'AMBASSADOR\_TO\_AMBASSADOR'\` or \`is\_self\_order \= true\` | **\*\*Ambassador\*\*** | rank card on CV |  
| everything else | **\*\*Customer\*\*** | Way 01 \+ 5% pools \+ 4%-of-CV generation |

**\*\*The buyer never earns on their own order\*\*** — payouts start from the buyer's parent.

**\#\#\# 1.2 — The basis each bucket uses**  
\- **\*\*CV \= 50% of retail\*\*** (\`orders.cv\_amount\`). Team/Generation on ambassador orders use CV.  
\- **\*\*Retail\*\*** (\`orders.subtotal\_cents\`) — customer commission \+ customer pools use retail.  
\- **\*\*Wholesale\*\*** \= the wholesale subtotal (already \~50% off); wholesale pools use the subtotal; wholesale counts toward GV at 100% of subtotal.  
\- **\*\*Coupons:\*\*** commissions compute on FULL retail; the discount is subtracted from the **\*\*direct seller's\*\*** line only (\`orders.discount\_cents\`). Pools are unaffected.

**\#\#\# 1.3 — Eligibility gates (per recipient)**  
1\. **\*\*Good Standing / Active\*\*** — \`affiliates.status \= 'approved'\`. Not approved → skipped, money compresses past them.  
2\. **\*\*Qualification (PQP)\*\*** — each rank has a personal-purchase threshold ($80 Ambassador … $500 Leader+). **\*\*One-time by default\*\*** (a single qualifying personal order satisfies it permanently). Runtime-switchable to monthly. A brand-new ambassador gets a 30-day Way-01 grace on referred customers' first orders.

**\#\#\# 1.4 — The payout stacks**  
**\*\*A. Customer order\*\*** (all on retail unless noted):  
\- **\*\*Way 01 (Customer Commission):\*\*** 25 / 30 / 35 / 40% of **\*\*retail\*\*** to the referrer, by their monthly Customer-PV tier, better of this month vs last. **\*\*Never compresses\*\*** — unpaid \= not paid. Pay area \`CUSTOMER\_SALES\`.  
\- **\*\*Team Pool:\*\*** 5% of retail, 4 seats of 1.25%, walk up from the referrer's parent, compress past unqualified, topmost absorbs unfilled. Pay areas \`TEAM\_POOL\_S1..4\`.  
\- **\*\*Generation (§36, since 2026-07-25):\*\*** flat **\*\*4% of CV per qualified generation\*\*** (Leader→G1 … Visionary→G1–4), depth-gated, compresses up. Pay areas \`GENERATION\_G1..4\`, **\*\*monthly\*\*** (accrued). *\*(Orders paid before 2026-07-25 use the old 5% Gen Pool — pay areas \`GEN\_POOL\_S\*\` — kept for history.)\**

**\*\*B. Ambassador order\*\*** (CV basis):  
\- **\*\*Team Pay:\*\*** rank card × CV, L1–L4 from the buyer's parent, each level compresses independently to the next upline who has it unlocked, paid at the receiver's rate. Pay areas \`TEAM\_L1..4\`.  
\- **\*\*Generation:\*\*** flat 4% of CV per qualified generation, monthly. \`GENERATION\_G1..4\`.

**\*\*C. Wholesale order:\*\***  
\- **\*\*10% direct\*\*** to enroller (\`WHOLESALE\_DIRECT\`; self-order → one level up).  
\- **\*\*5% Team Pool\*\*** (\`WHOLESALE\_TEAM\_S\*\`) \+ **\*\*5% Gen Pool\*\*** (\`WHOLESALE\_GEN\_S\*\`) — fixed 1.25% seats, **\*\*no absorption\*\*** (unfilled seats unpaid). Direct recipient holds no pool seat.

**\#\#\# 1.5 — The rank ladder (internal keys are PERMANENT; display names change)**  
| Internal key | Display name | Customers | GV | PQP | Team L2 rate |  
|---|---|---|---|---|---|  
| \`customer\` | Customer | 0 | 0 | $0 | — |  
| \`starter\` | **\*\*Ambassador\*\*** | 0 | 0 | $80 | — |  
| \`builder\` | **\*\*Partner\*\*** | 2 | $500 | $100 | 10% |  
| \`influencer\` | **\*\*Influencer\*\*** | 3 | $2,500 | $250 | 10% |  
| \`promoter\` | **\*\*Leader\*\*** | 4 | $5,000 | $500 | 10% |  
| \`leader\` | **\*\*Executive\*\*** | 5 | $10,000 | $500 | 15% |  
| \`director\` | **\*\*Director\*\*** | 6 | $25,000 | $500 | **\*\*15%\*\*** |  
| \`icon\` | **\*\*Visionary\*\*** | 8 | $50,000 | $500 | 20% |

\> ⚠ **\*\*The key offset is a permanent hazard.\*\*** Internal \`leader\` displays as **\*\*Executive\*\***; internal \`promoter\` displays as **\*\*Leader\*\***. Never surface the raw key. Always map through the display name (join \`rank\_definitions.rank\_name\`, or use the map above). "Qualified leader" for generation \= internal \`promoter\`\+ \= display **\*\*Leader\*\***\+.

**\#\#\# 1.6 — Caps, timing, reversals**  
\- **\*\*§37 cap:\*\*** total field payout ≤ **\*\*50% of RETAIL\*\*** on customer orders / **\*\*20%\*\*** on wholesale. Trimmed deepest-first (\`cap\_adjustment\_cents\` records any trim).  
\- **\*\*Timing:\*\*** weekly (Fri 00:00 → Thu 23:59 **\*\*CST\*\***, paid the next Friday) for Way01/Team/wholesale-direct; **\*\*monthly on the 5th\*\*** for ALL generation. \`$10\` minimum, 7-day hold.  
\- **\*\*Reversals:\*\*** refund/chargeback reverses every row (status \`reversed\`/\`voided\`); rank is never retro-revoked; net against the next check (floored at $0).

\---

**\#\# 2\. DISPLAY RULES (for a correct CRM UI)**

These are LAW (§38.1) — a number shown against the wrong basis reads as a bug even when the math is right.

1\. **\*\*Rank labels:\*\*** always the spec display name (Ambassador … Visionary), never the internal \`rank\_code\`.  
2\. **\*\*Every rate must state its basis\*\*** — never a bare percentage:  
  \- Way 01 → \`"25% of retail"\` (it's a % of RETAIL, not CV)  
  \- Rank-card team levels → \`"30% of CV"\`  
  \- Customer/wholesale pool seats → \`"5% Team Pool · seat 2 of 4"\` / \`"5% of wholesale · ..."\` (a seat is 1.25% of the pool basis — never show a bare "1.25%")  
  \- Generation → \`"4% of CV · generation 2"\`  
  \- Pre-2026-07-25 customer gen rows → mark **\*\*"legacy Gen Pool"\*\***  
3\. **\*\*CV vs retail:\*\*** show both when relevant (CV \= 50% of retail). Team/Gen amounts are on CV; Way 01 is on retail.  
4\. **\*\*Status:\*\*** \`held\` \= "Clearing (7-day hold)" · \`payable\` \= "Payable — next Friday" · \`paid\` \= "Paid" · \`accrued\` \= "Generation — pays on the 5th".  
5\. **\*\*Generation is monthly\*\*** — never show accrued generation as part of a *\*weekly\** payable total.  
6\. A pay area the CRM can't map must be surfaced, never silently dropped.

\---

**\#\# 3\. SCHEMA — the tables the CRM reads**

**\#\#\# 3.1 \`orders\` (83 cols) — the hub**  
**\*\*Identity/money:\*\*** \`id\`, \`user\_email\`, \`customer\_id\`, \`subtotal\_cents\` (retail), \`cv\_amount\`, \`pv\_amount\`, \`discount\_cents\`, \`tax\_cents\`, \`total\_cents\`, \`store\_credit\_applied\_cents\`, \`currency\`.  
**\*\*Classification:\*\*** \`order\_type\` (\`retail\`/\`wholesale\`), \`event\_type\`, \`buyer\_type\`, \`is\_self\_order\`, \`is\_guest\_checkout\`, \`is\_subscription\_order\`, \`wholesale\_account\_id\`.  
**\*\*Payment:\*\*** \`payment\_status\` (**\*\*see values below\*\***), \`payment\_gateway\`, \`payment\_method\_code\`, \`paid\_at\`, \`manual\_review\_required\`, \`card\_brand\`, \`card\_last4\`.  
**\*\*Shipping/fulfillment (see §4):\*\*** \`fulfillment\_status\`, \`fulfillment\_provider\`, \`shiphero\_order\_id\`, \`shiphero\_order\_number\`, \`shiphero\_synced\_at\`, \`fulfillment\_error\`, \`shipped\_at\`, \`delivered\_at\`, \`tracking\_number\`, \`tracking\_carrier\`, \`tracking\_url\`, \`tracking\_emailed\_at\`, \`shipping\_method\_label\`, \`shipping\_cost\_cents\`, \`warehouse\_id\`, \`shipstation\_order\_id\`, \`return\_label\_url\`.  
**\*\*Attribution:\*\*** \`affiliate\_chain\`, \`credited\_ambassador\_id\`, \`commission\_amounts\` (jsonb), \`counts\_toward\_pv/pcv/gv\`, \`counts\_as\_personal\_customer\`, \`pays\_l1\_commission\`.  
**\*\*Address:\*\*** \`shipping\_address\` (jsonb: \`first\_name\`, \`last\_name\`, \`address1\`, \`city\`, \`state\`, \`zip\`, …).  
**\*\*Timestamps:\*\*** \`created\_at\`, \`paid\_at\`, \`shipped\_at\`, \`delivered\_at\`.

\`payment\_status\` values: \`paid\`, \`expired\`, \`failed\`, \`manual\_review\`, \`canceled\`, \`refunded\`, \`comp\` (comp \= free/gifted order that still ships — COGS applies).  
\`fulfillment\_status\` values: \`not\_ready\`, \`shipped\`, \`cancelled\`/\`canceled\`.

**\#\#\# 3.2 \`order\_items\` — line items (products)**  
\`order\_id\`, \`product\_id\`, \`sku\`, \`name\`, \`unit\_price\_cents\`, \`quantity\`, \`line\_total\_cents\`, \`category\`.

**\#\#\# 3.3 \`commission\_ledger\` — every commission line**  
\`order\_id\`, \`affiliate\_id\`, \`pay\_area\` (see §1.4), \`level\`, \`amount\_cents\`, \`rate\_used\`, \`percentage\_bps\`, \`base\_cv\_amount\`, \`status\` (\`held\`/\`payable\`/\`paid\`/\`accrued\`/\`reversed\`/\`voided\`), \`pay\_cycle\` (\`weekly\`/\`monthly\`), \`hold\_until\`, \`paid\_at\`, \`cap\_adjustment\_cents\`, \`source\_affiliate\_id\`, \`compressed\_from\_id\`, \`compression\_reason\`, \`explanation\`, \`calculation\_trace\_json\` (per-row math trace — great for a "why" tooltip).

**\#\#\# 3.4 \`affiliates\` — ambassadors & customers**  
\`id\`, \`user\_id\`, \`email\`, \`name\`, \`parent\_id\` (genealogy), \`account\_type\` (\`AMBASSADOR\`/\`CUSTOMER\_ONLY\`), \`status\`, \`paid\_as\_rank\`, \`career\_rank\`, \`rank\`, \`rank\_override\`, \`rank\_override\_until\`, \`active\_customer\_count\`, \`personal\_volume\_cents\`, \`team\_volume\_cents\`, \`monthly\_pv\_cv\_cents\`, \`monthly\_gv\_cv\_cents\`, \`enrollment\_count\`, \`custom\_slug\`, \`tracking\_code\`, \`converted\_to\_ambassador\_at\`, \`needs\_sponsor\_review\` (orphan/attribution flag), \`reparent\_locked\`, \`payout\_details\` (jsonb — **\*\*contains bank info; the CRM must NOT display full account/routing, only \`card\_last4\`\-style masking\*\***).

**\#\#\# 3.5 \`support\_tickets\`**  
\`id\`, \`ticket\_number\`, \`status\`, \`priority\`, \`category\`, \`channel\`, \`subject\`, \`body\`, \`requester\_type\`, \`requester\_email\`, \`requester\_name\`, \`requester\_phone\`, \`related\_order\_id\`, \`related\_product\_id\`, \`assigned\_admin\_id\`, \`tags\`, \`message\_count\`, \`first\_response\_at\`, \`resolved\_at\`, \`closed\_at\`, \`last\_activity\_at\`, \`created\_at\`.

**\#\#\# 3.6 Supporting**  
\- \`affiliate\_attributions\` — \`order\_id\`, \`affiliate\_id\`, \`tracking\_code\`, \`chain\_snapshot\` (who was credited, frozen at order time).  
\- \`rank\_definitions\` — \`rank\_code\`, \`rank\_name\` (display), \`rank\_order\`, thresholds. **\*\*Join here to get display names.\*\***  
\- \`wholesale\_accounts\` — B2B accounts, \`enrolled\_by\_affiliate\_id\`.  
\- \`payout\_batches\` / \`payout\_batch\_items\` — what was actually sent (never contains raw account numbers in the CRM view).  
\- \`shipping\_sync\_queue\` — \`order\_id\`, \`provider\`, \`status\`, \`attempts\`, \`last\_error\`, \`next\_retry\_at\` — the fulfillment push pipeline (see §4).

\---

\#\# 4\. SHIPPING & FULFILLMENT — the views the CRM needs

Fulfillment \= ShipHero (\`fulfillment\_provider\`, \`shiphero\_order\_id/number\`). The lifecycle:

\`paid\_at\` → (queued in \`shipping\_sync\_queue\`) → pushed to ShipHero (\`shiphero\_synced\_at\`) → \`fulfillment\_status='shipped'\` \+ \`shipped\_at\` \+ tracking → \`delivered\_at\`.

\#\#\# 4.1 "Time from order to warehouse-out" (a key CRM metric)  
\`\`\`sql  
SELECT id, shiphero\_order\_number, user\_email,  
      paid\_at, shipped\_at,  
      EXTRACT(EPOCH FROM (shipped\_at \- paid\_at))/3600 AS hours\_to\_ship,  
      fulfillment\_status, tracking\_carrier, tracking\_number  
FROM orders  
WHERE payment\_status IN ('paid','comp') AND shipped\_at IS NOT NULL  
ORDER BY paid\_at DESC;  
\`\`\`  
Display as "Ordered → Shipped" duration. Also expose \`shiphero\_synced\_at \- paid\_at\` (time to reach the warehouse) vs \`shipped\_at \- shiphero\_synced\_at\` (warehouse dwell time).

\#\#\# 4.2 Stranded shipments (paid, not shipped, aging) — a CRM alert list  
\`\`\`sql  
SELECT id, shiphero\_order\_number, user\_email, subtotal\_cents,  
      paid\_at, EXTRACT(DAY FROM now() \- paid\_at) AS days\_waiting,  
      fulfillment\_status, fulfillment\_error, shiphero\_synced\_at  
FROM orders  
WHERE payment\_status IN ('paid','comp')  
 AND is\_self\_order IS NOT TRUE  
 AND COALESCE(fulfillment\_status,'not\_ready') NOT IN ('shipped','cancelled','canceled')  
 AND paid\_at \< now() \- interval '2 days'  
ORDER BY paid\_at;  
\`\`\`  
Show \`fulfillment\_error\` prominently — it's why the order stalled. Cross-reference \`shipping\_sync\_queue.last\_error\` / \`next\_retry\_at\` for the push-pipeline state.

\#\#\# 4.3 Correct COGS / units-shipped (for reporting)  
COGS \= product that \*\*physically shipped\*\* — filter on \`fulfillment\_status='shipped'\`, NOT \`payment\_status='paid'\` (paid-but-cancelled orders never left inventory). Include \`comp\` orders (free product still ships). Sum \`order\_items.quantity\` grouped by \`sku\`.

\---

\#\# 5\. ORPHANED / ATTENTION-NEEDED AMBASSADORS

\`\`\`sql  
\-- Orphans & attribution-review flags  
SELECT id, name, email, account\_type, parent\_id, needs\_sponsor\_review, created\_at  
FROM affiliates  
WHERE needs\_sponsor\_review \= true          \-- flagged for sponsor/attribution review  
  OR (account\_type \= 'AMBASSADOR' AND parent\_id IS NULL AND status='approved');  \-- true orphans (no upline)  
\`\`\`  
\`needs\_sponsor\_review \= true\` \= attribution needs a human decision (usually a customer's referrer). A \`parent\_id IS NULL\` ambassador is a genealogy root (may be legitimate — e.g. the top of the tree — so present as "review," not "error").

\---

\#\# 6\. REPORTS the CRM can surface (all read-only)

Rebuild these as CRM views/queries, or call the XO Pure admin API (§7):  
\- \*\*Owed today\*\* — \`SUM(amount\_cents) WHERE status='payable'\` grouped by \`affiliate\_id\`, with \`held\` (clearing) and \`accrued\` (gen-monthly) shown separately. This is the pre-payout checklist.  
\- \*\*Weekly commission log\*\* — ledger rows in the Fri–Thu CST window, joined to order \+ ambassador, ordered order→level (reads top-down like a payout tree).  
\- \*\*Per-ambassador statement\*\* — one ambassador's sales \+ earnings \+ downline (walk \`parent\_id\`).  
\- \*\*Compensation audit\*\* — one row per (order × commission event); the QA-grade export.  
\- \*\*COGS / units shipped\*\* — §4.3.  
\- \*\*Ticket queue\*\* — open \`support\_tickets\` by status/priority/assignee.

\---

\#\# 7\. WHEN THE CRM MUST \*ACT\* — use the XO Pure API, never a direct write

All are \`https://xopure.com/api/...\`, require an admin Bearer token, and run server-side with the service role. The CRM calls these instead of writing to Supabase:

| Need | Endpoint (GET unless noted) | Notes |  
|---|---|---|  
| Owed-today report | \`/api/admin/report/owed-today\` | payable-by-ambassador \+ rail/blockers |  
| Compensation audit export | \`/api/admin/export/compensation-audit?from\&to\&format=csv\\|json\` | core-admin only (brian/brad/g) |  
| Commissions / orders / payouts / affiliates export | \`/api/admin/export/{commissions,orders,payouts,affiliates}?from\&to\` | returns \`{ csv, filename, row\_count }\` |  
| Per-ambassador statement | \`/api/admin/ambassador-report?email=\&format=json\\|csv\\|md\` | full statement \+ tree |  
| Commission dashboard payload | \`/api/admin/commission-dashboard\` | the whole dashboard data model, computed live |  
| Reparent an ambassador | \`POST /api/admin/reparent-affiliate\` | \`{ child, new\_parent, reason, credit\_mode }\` — writes; admin-gated |  
| Trigger fulfillment re-push | (via \`shipping\_sync\_queue\` insert on the main app) | do NOT write from CRM; call the main app |

\*\*Auth:\*\* every endpoint verifies a Supabase JWT with \`has\_role(user,'admin')\`. The CRM's admin users must authenticate against the same Supabase Auth and pass their token.

\---

\#\# 8\. INTEGRATION CHECKLIST

\- \[ \] Read-only Postgres role (\`GRANT SELECT\` only); \*\*no service-role key in the CRM.\*\*  
\- \[ \] RLS left ON; connect as a role whose policies grant the CRM's needed visibility, OR read through the admin API (§7).  
\- \[ \] Rank display names via \`rank\_definitions.rank\_name\` — never raw \`rank\_code\`.  
\- \[ \] Every rate labeled with its basis (§2).  
\- \[ \] \`payout\_details\` bank fields masked (last4 only) or excluded.  
\- \[ \] Money is integer cents everywhere — divide by 100 for display.  
\- \[ \] Times are UTC in the DB; the comp week is Fri 00:00 → Thu 23:59 \*\*CST (UTC-6, fixed)\*\*. Convert for display.  
\- \[ \] Generation money (\`pay\_cycle='monthly'\` / \`status='accrued'\`) shown separately from weekly payable.  
\- \[ \] All \*writes\* go through the XO Pure API, never direct SQL.

\---

\#\# 9\. SOURCES OF TRUTH (for deeper detail)  
\- \*\*\`COMP\_PLAN\_LAW.md\`\*\* — the authoritative comp law (through §38).  
\- \*\*\`docs/XO\_PURE\_COMP\_PLAN\_RULES\_REGISTRY\_V4.yaml\`\*\* — the structured single-file rulebook (rule IDs).  
\- \*\*\`src/integrations/supabase/types.ts\`\*\* — generated TypeScript types for every table (import these into the CRM for type-safe reads).  
\- \*\*\`docs/DEEP\_ENGINE\_AUDIT\_2026-07-25.md\`\*\* — known engine nuances (weekly-rank-retro, dormant paths).

\*The comp engine is the source of truth for all numbers; the CRM mirrors and displays them. When in doubt, the ledger row (\`commission\_ledger\`) is what was actually calculated — trust it over any re-derivation.\*

**\# XO Pure CRM Integration — Developer Guide (\`crm.xopure.com\`)**

**\*\*Audience:\*\*** the developer building the third-party CRM at \`crm.xopure.com\`.  
**\*\*Purpose:\*\*** everything needed to pull orders, shipping, commissions, tickets, and ambassador data out of XO Pure's Supabase and **\*\*display it correctly\*\*** — with the exact comp-plan rules the numbers must obey.  
**\*\*Last verified against production:\*\*** 2026-07-25.

\---

**\#\# 0\. THE READ-ONLY RULE (read this first)**

**\*\*The CRM connects to Supabase with a READ-ONLY role. It must never write.\*\***

\- Use a dedicated read-only Postgres role (e.g. \`crm\_readonly\`) with \`GRANT SELECT\` only — **\*\*no INSERT/UPDATE/DELETE, no service\_role key.\*\*** The service-role key bypasses RLS and can write; it must **\*\*never\*\*** ship in the CRM.  
\- The CRM is a **\*\*mirror\*\***, not a source of truth. Order status, commissions, ranks, shipping — all of it is computed and written by the main XO Pure app \+ its cron jobs. The CRM displays that state; it does not change it.  
\- If the CRM needs to *\*act\** (create a ticket, trigger a re-ship), it must call a **\*\*dedicated XO Pure API endpoint\*\*** (service-role, server-side) — never write to Supabase directly. Those endpoints are listed in §7.  
\- **\*\*RLS is ON\*\*** for \`orders\`, \`affiliates\`, \`commission\_ledger\`, \`support\_tickets\`. A plain read-only role sees only what its policies allow. For a full-visibility admin CRM, either (a) connect as a role whose RLS policies grant broad SELECT, or (b) pull through the XO Pure admin API (§7) which uses the service role behind admin auth. **\*\*Do not disable RLS.\*\***

\---

**\#\# 1\. THE COMP ENGINE — start to finish**

Every order runs through this decision tree. The CRM must understand it to display commissions correctly.

**\#\#\# 1.1 — Classify the order (one of three; this picks the entire model)**  
| \`orders.order\_type\` / \`event\_type\` | CRM label | Model |  
|---|---|---|  
| \`order\_type \= 'wholesale'\` | **\*\*Wholesale\*\*** | 10 / 5 / 5 of subtotal |  
| \`event\_type \= 'AMBASSADOR\_TO\_AMBASSADOR'\` or \`is\_self\_order \= true\` | **\*\*Ambassador\*\*** | rank card on CV |  
| everything else | **\*\*Customer\*\*** | Way 01 \+ 5% pools \+ 4%-of-CV generation |

**\*\*The buyer never earns on their own order\*\*** — payouts start from the buyer's parent.

**\#\#\# 1.2 — The basis each bucket uses**  
\- **\*\*CV \= 50% of retail\*\*** (\`orders.cv\_amount\`). Team/Generation on ambassador orders use CV.  
\- **\*\*Retail\*\*** (\`orders.subtotal\_cents\`) — customer commission \+ customer pools use retail.  
\- **\*\*Wholesale\*\*** \= the wholesale subtotal (already \~50% off); wholesale pools use the subtotal; wholesale counts toward GV at 100% of subtotal.  
\- **\*\*Coupons:\*\*** commissions compute on FULL retail; the discount is subtracted from the **\*\*direct seller's\*\*** line only (\`orders.discount\_cents\`). Pools are unaffected.

**\#\#\# 1.3 — Eligibility gates (per recipient)**  
1\. **\*\*Good Standing / Active\*\*** — \`affiliates.status \= 'approved'\`. Not approved → skipped, money compresses past them.  
2\. **\*\*Qualification (PQP)\*\*** — each rank has a personal-purchase threshold ($80 Ambassador … $500 Leader+). **\*\*One-time by default\*\*** (a single qualifying personal order satisfies it permanently). Runtime-switchable to monthly. A brand-new ambassador gets a 30-day Way-01 grace on referred customers' first orders.

**\#\#\# 1.4 — The payout stacks**  
**\*\*A. Customer order\*\*** (all on retail unless noted):  
\- **\*\*Way 01 (Customer Commission):\*\*** 25 / 30 / 35 / 40% of **\*\*retail\*\*** to the referrer, by their monthly Customer-PV tier, better of this month vs last. **\*\*Never compresses\*\*** — unpaid \= not paid. Pay area \`CUSTOMER\_SALES\`.  
\- **\*\*Team Pool:\*\*** 5% of retail, 4 seats of 1.25%, walk up from the referrer's parent, compress past unqualified, topmost absorbs unfilled. Pay areas \`TEAM\_POOL\_S1..4\`.  
\- **\*\*Generation (§36, since 2026-07-25):\*\*** flat **\*\*4% of CV per qualified generation\*\*** (Leader→G1 … Visionary→G1–4), depth-gated, compresses up. Pay areas \`GENERATION\_G1..4\`, **\*\*monthly\*\*** (accrued). *\*(Orders paid before 2026-07-25 use the old 5% Gen Pool — pay areas \`GEN\_POOL\_S\*\` — kept for history.)\**

**\*\*B. Ambassador order\*\*** (CV basis):  
\- **\*\*Team Pay:\*\*** rank card × CV, L1–L4 from the buyer's parent, each level compresses independently to the next upline who has it unlocked, paid at the receiver's rate. Pay areas \`TEAM\_L1..4\`.  
\- **\*\*Generation:\*\*** flat 4% of CV per qualified generation, monthly. \`GENERATION\_G1..4\`.

**\*\*C. Wholesale order:\*\***  
\- **\*\*10% direct\*\*** to enroller (\`WHOLESALE\_DIRECT\`; self-order → one level up).  
\- **\*\*5% Team Pool\*\*** (\`WHOLESALE\_TEAM\_S\*\`) \+ **\*\*5% Gen Pool\*\*** (\`WHOLESALE\_GEN\_S\*\`) — fixed 1.25% seats, **\*\*no absorption\*\*** (unfilled seats unpaid). Direct recipient holds no pool seat.

**\#\#\# 1.5 — The rank ladder (internal keys are PERMANENT; display names change)**  
| Internal key | Display name | Customers | GV | PQP | Team L2 rate |  
|---|---|---|---|---|---|  
| \`customer\` | Customer | 0 | 0 | $0 | — |  
| \`starter\` | **\*\*Ambassador\*\*** | 0 | 0 | $80 | — |  
| \`builder\` | **\*\*Partner\*\*** | 2 | $500 | $100 | 10% |  
| \`influencer\` | **\*\*Influencer\*\*** | 3 | $2,500 | $250 | 10% |  
| \`promoter\` | **\*\*Leader\*\*** | 4 | $5,000 | $500 | 10% |  
| \`leader\` | **\*\*Executive\*\*** | 5 | $10,000 | $500 | 15% |  
| \`director\` | **\*\*Director\*\*** | 6 | $25,000 | $500 | **\*\*15%\*\*** |  
| \`icon\` | **\*\*Visionary\*\*** | 8 | $50,000 | $500 | 20% |

\> ⚠ **\*\*The key offset is a permanent hazard.\*\*** Internal \`leader\` displays as **\*\*Executive\*\***; internal \`promoter\` displays as **\*\*Leader\*\***. Never surface the raw key. Always map through the display name (join \`rank\_definitions.rank\_name\`, or use the map above). "Qualified leader" for generation \= internal \`promoter\`\+ \= display **\*\*Leader\*\***\+.

**\#\#\# 1.6 — Caps, timing, reversals**  
\- **\*\*§37 cap:\*\*** total field payout ≤ **\*\*50% of RETAIL\*\*** on customer orders / **\*\*20%\*\*** on wholesale. Trimmed deepest-first (\`cap\_adjustment\_cents\` records any trim).  
\- **\*\*Timing:\*\*** weekly (Fri 00:00 → Thu 23:59 **\*\*CST\*\***, paid the next Friday) for Way01/Team/wholesale-direct; **\*\*monthly on the 5th\*\*** for ALL generation. \`$10\` minimum, 7-day hold.  
\- **\*\*Reversals:\*\*** refund/chargeback reverses every row (status \`reversed\`/\`voided\`); rank is never retro-revoked; net against the next check (floored at $0).

\---

**\#\# 2\. DISPLAY RULES (for a correct CRM UI)**

These are LAW (§38.1) — a number shown against the wrong basis reads as a bug even when the math is right.

1\. **\*\*Rank labels:\*\*** always the spec display name (Ambassador … Visionary), never the internal \`rank\_code\`.  
2\. **\*\*Every rate must state its basis\*\*** — never a bare percentage:  
  \- Way 01 → \`"25% of retail"\` (it's a % of RETAIL, not CV)  
  \- Rank-card team levels → \`"30% of CV"\`  
  \- Customer/wholesale pool seats → \`"5% Team Pool · seat 2 of 4"\` / \`"5% of wholesale · ..."\` (a seat is 1.25% of the pool basis — never show a bare "1.25%")  
  \- Generation → \`"4% of CV · generation 2"\`  
  \- Pre-2026-07-25 customer gen rows → mark **\*\*"legacy Gen Pool"\*\***  
3\. **\*\*CV vs retail:\*\*** show both when relevant (CV \= 50% of retail). Team/Gen amounts are on CV; Way 01 is on retail.  
4\. **\*\*Status:\*\*** \`held\` \= "Clearing (7-day hold)" · \`payable\` \= "Payable — next Friday" · \`paid\` \= "Paid" · \`accrued\` \= "Generation — pays on the 5th".  
5\. **\*\*Generation is monthly\*\*** — never show accrued generation as part of a *\*weekly\** payable total.  
6\. A pay area the CRM can't map must be surfaced, never silently dropped.

\---

**\#\# 3\. SCHEMA — the tables the CRM reads**

**\#\#\# 3.1 \`orders\` (83 cols) — the hub**  
**\*\*Identity/money:\*\*** \`id\`, \`user\_email\`, \`customer\_id\`, \`subtotal\_cents\` (retail), \`cv\_amount\`, \`pv\_amount\`, \`discount\_cents\`, \`tax\_cents\`, \`total\_cents\`, \`store\_credit\_applied\_cents\`, \`currency\`.  
**\*\*Classification:\*\*** \`order\_type\` (\`retail\`/\`wholesale\`), \`event\_type\`, \`buyer\_type\`, \`is\_self\_order\`, \`is\_guest\_checkout\`, \`is\_subscription\_order\`, \`wholesale\_account\_id\`.  
**\*\*Payment:\*\*** \`payment\_status\` (**\*\*see values below\*\***), \`payment\_gateway\`, \`payment\_method\_code\`, \`paid\_at\`, \`manual\_review\_required\`, \`card\_brand\`, \`card\_last4\`.  
**\*\*Shipping/fulfillment (see §4):\*\*** \`fulfillment\_status\`, \`fulfillment\_provider\`, \`shiphero\_order\_id\`, \`shiphero\_order\_number\`, \`shiphero\_synced\_at\`, \`fulfillment\_error\`, \`shipped\_at\`, \`delivered\_at\`, \`tracking\_number\`, \`tracking\_carrier\`, \`tracking\_url\`, \`tracking\_emailed\_at\`, \`shipping\_method\_label\`, \`shipping\_cost\_cents\`, \`warehouse\_id\`, \`shipstation\_order\_id\`, \`return\_label\_url\`.  
**\*\*Attribution:\*\*** \`affiliate\_chain\`, \`credited\_ambassador\_id\`, \`commission\_amounts\` (jsonb), \`counts\_toward\_pv/pcv/gv\`, \`counts\_as\_personal\_customer\`, \`pays\_l1\_commission\`.  
**\*\*Address:\*\*** \`shipping\_address\` (jsonb: \`first\_name\`, \`last\_name\`, \`address1\`, \`city\`, \`state\`, \`zip\`, …).  
**\*\*Timestamps:\*\*** \`created\_at\`, \`paid\_at\`, \`shipped\_at\`, \`delivered\_at\`.

\`payment\_status\` values: \`paid\`, \`expired\`, \`failed\`, \`manual\_review\`, \`canceled\`, \`refunded\`, \`comp\` (comp \= free/gifted order that still ships — COGS applies).  
\`fulfillment\_status\` values: \`not\_ready\`, \`shipped\`, \`cancelled\`/\`canceled\`.

**\#\#\# 3.2 \`order\_items\` — line items (products)**  
\`order\_id\`, \`product\_id\`, \`sku\`, \`name\`, \`unit\_price\_cents\`, \`quantity\`, \`line\_total\_cents\`, \`category\`.

**\#\#\# 3.3 \`commission\_ledger\` — every commission line**  
\`order\_id\`, \`affiliate\_id\`, \`pay\_area\` (see §1.4), \`level\`, \`amount\_cents\`, \`rate\_used\`, \`percentage\_bps\`, \`base\_cv\_amount\`, \`status\` (\`held\`/\`payable\`/\`paid\`/\`accrued\`/\`reversed\`/\`voided\`), \`pay\_cycle\` (\`weekly\`/\`monthly\`), \`hold\_until\`, \`paid\_at\`, \`cap\_adjustment\_cents\`, \`source\_affiliate\_id\`, \`compressed\_from\_id\`, \`compression\_reason\`, \`explanation\`, \`calculation\_trace\_json\` (per-row math trace — great for a "why" tooltip).

**\#\#\# 3.4 \`affiliates\` — ambassadors & customers**  
\`id\`, \`user\_id\`, \`email\`, \`name\`, \`parent\_id\` (genealogy), \`account\_type\` (\`AMBASSADOR\`/\`CUSTOMER\_ONLY\`), \`status\`, \`paid\_as\_rank\`, \`career\_rank\`, \`rank\`, \`rank\_override\`, \`rank\_override\_until\`, \`active\_customer\_count\`, \`personal\_volume\_cents\`, \`team\_volume\_cents\`, \`monthly\_pv\_cv\_cents\`, \`monthly\_gv\_cv\_cents\`, \`enrollment\_count\`, \`custom\_slug\`, \`tracking\_code\`, \`converted\_to\_ambassador\_at\`, \`needs\_sponsor\_review\` (orphan/attribution flag), \`reparent\_locked\`, \`payout\_details\` (jsonb — **\*\*contains bank info; the CRM must NOT display full account/routing, only \`card\_last4\`\-style masking\*\***).

**\#\#\# 3.5 \`support\_tickets\`**  
\`id\`, \`ticket\_number\`, \`status\`, \`priority\`, \`category\`, \`channel\`, \`subject\`, \`body\`, \`requester\_type\`, \`requester\_email\`, \`requester\_name\`, \`requester\_phone\`, \`related\_order\_id\`, \`related\_product\_id\`, \`assigned\_admin\_id\`, \`tags\`, \`message\_count\`, \`first\_response\_at\`, \`resolved\_at\`, \`closed\_at\`, \`last\_activity\_at\`, \`created\_at\`.

**\#\#\# 3.6 Supporting**  
\- \`affiliate\_attributions\` — \`order\_id\`, \`affiliate\_id\`, \`tracking\_code\`, \`chain\_snapshot\` (who was credited, frozen at order time).  
\- \`rank\_definitions\` — \`rank\_code\`, \`rank\_name\` (display), \`rank\_order\`, thresholds. **\*\*Join here to get display names.\*\***  
\- \`wholesale\_accounts\` — B2B accounts, \`enrolled\_by\_affiliate\_id\`.  
\- \`payout\_batches\` / \`payout\_batch\_items\` — what was actually sent (never contains raw account numbers in the CRM view).  
\- \`shipping\_sync\_queue\` — \`order\_id\`, \`provider\`, \`status\`, \`attempts\`, \`last\_error\`, \`next\_retry\_at\` — the fulfillment push pipeline (see §4).

\---

\#\# 4\. SHIPPING & FULFILLMENT — the views the CRM needs

Fulfillment \= ShipHero (\`fulfillment\_provider\`, \`shiphero\_order\_id/number\`). The lifecycle:

\`paid\_at\` → (queued in \`shipping\_sync\_queue\`) → pushed to ShipHero (\`shiphero\_synced\_at\`) → \`fulfillment\_status='shipped'\` \+ \`shipped\_at\` \+ tracking → \`delivered\_at\`.

\#\#\# 4.1 "Time from order to warehouse-out" (a key CRM metric)  
\`\`\`sql  
SELECT id, shiphero\_order\_number, user\_email,  
      paid\_at, shipped\_at,  
      EXTRACT(EPOCH FROM (shipped\_at \- paid\_at))/3600 AS hours\_to\_ship,  
      fulfillment\_status, tracking\_carrier, tracking\_number  
FROM orders  
WHERE payment\_status IN ('paid','comp') AND shipped\_at IS NOT NULL  
ORDER BY paid\_at DESC;  
\`\`\`  
Display as "Ordered → Shipped" duration. Also expose \`shiphero\_synced\_at \- paid\_at\` (time to reach the warehouse) vs \`shipped\_at \- shiphero\_synced\_at\` (warehouse dwell time).

\#\#\# 4.2 Stranded shipments (paid, not shipped, aging) — a CRM alert list  
\`\`\`sql  
SELECT id, shiphero\_order\_number, user\_email, subtotal\_cents,  
      paid\_at, EXTRACT(DAY FROM now() \- paid\_at) AS days\_waiting,  
      fulfillment\_status, fulfillment\_error, shiphero\_synced\_at  
FROM orders  
WHERE payment\_status IN ('paid','comp')  
 AND is\_self\_order IS NOT TRUE  
 AND COALESCE(fulfillment\_status,'not\_ready') NOT IN ('shipped','cancelled','canceled')  
 AND paid\_at \< now() \- interval '2 days'  
ORDER BY paid\_at;  
\`\`\`  
Show \`fulfillment\_error\` prominently — it's why the order stalled. Cross-reference \`shipping\_sync\_queue.last\_error\` / \`next\_retry\_at\` for the push-pipeline state.

\#\#\# 4.3 Correct COGS / units-shipped (for reporting)  
COGS \= product that \*\*physically shipped\*\* — filter on \`fulfillment\_status='shipped'\`, NOT \`payment\_status='paid'\` (paid-but-cancelled orders never left inventory). Include \`comp\` orders (free product still ships). Sum \`order\_items.quantity\` grouped by \`sku\`.

\---

\#\# 5\. ORPHANED / ATTENTION-NEEDED AMBASSADORS

\`\`\`sql  
\-- Orphans & attribution-review flags  
SELECT id, name, email, account\_type, parent\_id, needs\_sponsor\_review, created\_at  
FROM affiliates  
WHERE needs\_sponsor\_review \= true          \-- flagged for sponsor/attribution review  
  OR (account\_type \= 'AMBASSADOR' AND parent\_id IS NULL AND status='approved');  \-- true orphans (no upline)  
\`\`\`  
\`needs\_sponsor\_review \= true\` \= attribution needs a human decision (usually a customer's referrer). A \`parent\_id IS NULL\` ambassador is a genealogy root (may be legitimate — e.g. the top of the tree — so present as "review," not "error").

\---

\#\# 6\. REPORTS the CRM can surface (all read-only)

Rebuild these as CRM views/queries, or call the XO Pure admin API (§7):  
\- \*\*Owed today\*\* — \`SUM(amount\_cents) WHERE status='payable'\` grouped by \`affiliate\_id\`, with \`held\` (clearing) and \`accrued\` (gen-monthly) shown separately. This is the pre-payout checklist.  
\- \*\*Weekly commission log\*\* — ledger rows in the Fri–Thu CST window, joined to order \+ ambassador, ordered order→level (reads top-down like a payout tree).  
\- \*\*Per-ambassador statement\*\* — one ambassador's sales \+ earnings \+ downline (walk \`parent\_id\`).  
\- \*\*Compensation audit\*\* — one row per (order × commission event); the QA-grade export.  
\- \*\*COGS / units shipped\*\* — §4.3.  
\- \*\*Ticket queue\*\* — open \`support\_tickets\` by status/priority/assignee.

\---

\#\# 7\. WHEN THE CRM MUST \*ACT\* — use the XO Pure API, never a direct write

All are \`https://xopure.com/api/...\`, require an admin Bearer token, and run server-side with the service role. The CRM calls these instead of writing to Supabase:

| Need | Endpoint (GET unless noted) | Notes |  
|---|---|---|  
| Owed-today report | \`/api/admin/report/owed-today\` | payable-by-ambassador \+ rail/blockers |  
| Compensation audit export | \`/api/admin/export/compensation-audit?from\&to\&format=csv\\|json\` | core-admin only (brian/brad/g) |  
| Commissions / orders / payouts / affiliates export | \`/api/admin/export/{commissions,orders,payouts,affiliates}?from\&to\` | returns \`{ csv, filename, row\_count }\` |  
| Per-ambassador statement | \`/api/admin/ambassador-report?email=\&format=json\\|csv\\|md\` | full statement \+ tree |  
| Commission dashboard payload | \`/api/admin/commission-dashboard\` | the whole dashboard data model, computed live |  
| Reparent an ambassador | \`POST /api/admin/reparent-affiliate\` | \`{ child, new\_parent, reason, credit\_mode }\` — writes; admin-gated |  
| Trigger fulfillment re-push | (via \`shipping\_sync\_queue\` insert on the main app) | do NOT write from CRM; call the main app |

\*\*Auth:\*\* every endpoint verifies a Supabase JWT with \`has\_role(user,'admin')\`. The CRM's admin users must authenticate against the same Supabase Auth and pass their token.

\---

\#\# 8\. INTEGRATION CHECKLIST

\- \[ \] Read-only Postgres role (\`GRANT SELECT\` only); \*\*no service-role key in the CRM.\*\*  
\- \[ \] RLS left ON; connect as a role whose policies grant the CRM's needed visibility, OR read through the admin API (§7).  
\- \[ \] Rank display names via \`rank\_definitions.rank\_name\` — never raw \`rank\_code\`.  
\- \[ \] Every rate labeled with its basis (§2).  
\- \[ \] \`payout\_details\` bank fields masked (last4 only) or excluded.  
\- \[ \] Money is integer cents everywhere — divide by 100 for display.  
\- \[ \] Times are UTC in the DB; the comp week is Fri 00:00 → Thu 23:59 \*\*CST (UTC-6, fixed)\*\*. Convert for display.  
\- \[ \] Generation money (\`pay\_cycle='monthly'\` / \`status='accrued'\`) shown separately from weekly payable.  
\- \[ \] All \*writes\* go through the XO Pure API, never direct SQL.

\---

\#\# 9\. SOURCES OF TRUTH (for deeper detail)  
\- \*\*\`COMP\_PLAN\_LAW.md\`\*\* — the authoritative comp law (through §38).  
\- \*\*\`docs/XO\_PURE\_COMP\_PLAN\_RULES\_REGISTRY\_V4.yaml\`\*\* — the structured single-file rulebook (rule IDs).  
\- \*\*\`src/integrations/supabase/types.ts\`\*\* — generated TypeScript types for every table (import these into the CRM for type-safe reads).  
\- \*\*\`docs/DEEP\_ENGINE\_AUDIT\_2026-07-25.md\`\*\* — known engine nuances (weekly-rank-retro, dormant paths).

\*The comp engine is the source of truth for all numbers; the CRM mirrors and displays them. When in doubt, the ledger row (\`commission\_ledger\`) is what was actually calculated — trust it over any re-derivation.\*

