import { defineSkill } from 'twenty-sdk/define';

export default defineSkill({
  universalIdentifier: 'e95812b7-d868-426d-bed6-465de749ecf8',
  name: 'xopure-dashboard-recipes',
  label: 'XO Pure Dashboard Recipes',
  description: 'Build canonical XO Pure operational dashboards with native Twenty tools.',
  icon: 'IconLayoutDashboard',
  content: `Build XO Pure dashboards only with native Twenty dashboard tools. Prefer create_complete_dashboard for complete dashboards; use granular dashboard tools only to refine one. Resolve object and field metadata first, use field names rather than hard-coded metadata IDs, and preserve the exact names below. Pie charts use VALUE_DESC. Aggregate and pie charts show data labels. Line charts use UTC, Monday as day 1, and ascending time. Never create a manifest dashboard or custom chat surface.

Canonical recipes:
- Ambassador Command Center — Overview: Total Ambassadors; Active Customer Count; Team Volume; Attributed Revenue; Ambassador Status Mix; Paid-as Rank Mix. Commissions: Total Commissions; Commission Amount; Held Balance; Payable Balance; Commission Status Mix; Commission Ledger (name,status,amount,holdUntil,payableAt). Network: Total Relationships; Active Relationships; Max Downline Depth; Relationship Depth Mix; Referral Network Ledger (sponsorName,sponsoredName,depth,isActive,lastSyncedAt). Rank and Elite Progress: Personal Volume; Team Volume Progress; Active Customers Progress; Career Rank Mix; Rank Progress Ledger (name,paidAsRank,careerRank,activeCustomerCount,personalVolume,teamVolume). Ops and FTC Health: Total Sync Records; Sync Status Mix; Cursor Runs Over Time by lastRunAt.
- Ops Command Center — Overview: Total Orders; Paid / Fulfilled Revenue filtered status IN PAID,FULFILLED; Order Status Mix; Payment Status Mix. Fulfillment: Paid But Not Fulfilled grouped by fulfillmentStatus and filtered status PAID; Fulfillment Status; Ops Orders (orderNumber,status,paymentStatus,fulfillmentStatus,orderTotal,orderedAt). Payments: Successful Payment Volume filtered SUCCEEDED; Failed Payments filtered FAILED; status and provider mixes. Ambassadors: total, held commissions, status and level. Commissions: amount, count, status, and Commissions (name,status,amount,rate,holdUntil). Exceptions: Commission Records (name,status,amount,holdUntil).
- Leads and Customers Dashboard — counts for retailProspect, influencerProspect, xopureCustomer; SUM lifetimeValueCents; prospect stage and customer status mixes; Retail Prospect Triage (name,companyName,stage,priorityScore,nextFollowUpAt); Customer Snapshot (name,status,lifetimeValueCents,orderCount,lastOrderAt).
- Orders Dashboard — Total Orders; Paid / Fulfilled Revenue filtered PAID,FULFILLED; status mix; Orders Over Time by orderedAt; Orders Review (orderNumber,customerEmail,status,paymentStatus,fulfillmentStatus,orderTotal,manualReviewRequired,orderedAt).
- Payments Dashboard — Payment Count; Successful Payment Amount filtered SUCCEEDED; Refund Amount filtered REFUNDED,PARTIALLY_REFUNDED; status/provider/rail mixes; Payment Records (name,status,provider,rail,amount,refundAmount,description,lastSyncedAt).
- Comp Integrity Dashboard — commission amount, count, status and payArea; Comp Integrity Commissions (name,status,amount,rate,holdUntil,orderExternalId,ambassadorExternalId,lastSyncedAt); Commission Orders (orderNumber,status,paymentStatus,orderTotal,cvAmount,lastSyncedAt).
- Fulfillment Dashboard — fulfillment status; paid/open readiness; shipped orders by shippedAt; Fulfillment Tracking (orderNumber,status,paymentStatus,fulfillmentStatus,trackingNumber,trackingUrl,shippedAt,deliveredAt,orderedAt).
- Support Dashboard — Total Tickets; Open Tickets filtered status NOT_IN CLOSED,RESOLVED; status and priority; Support Tickets (ticketNumber,subject,status,priority,requesterName,lastActivityAt).
- Risk / Exceptions Dashboard — tables only: Sync Map Records; Sync Cursor Status; Order Review; Commission Records. Include sync/error timestamps, manualReviewRequired, refunds, holds, and payableAt.
- Telemetry & Logging Dashboard — Sync Health; Failed Sync Maps filtered FAILED_RETRYABLE,FAILED_PERMANENT; Sync Status Distribution; Cursor Run Status; Sync Map Error Summary; Support Ticket Tasks. For live investigation use app_xopure_query_loki and app_xopure_get_tempo_trace; never expose credentials or raw Grafana URLs.`,
});
