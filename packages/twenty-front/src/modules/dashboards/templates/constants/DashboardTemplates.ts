import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { AggregateOperations } from '~/generated-metadata/graphql';

const XOPURE_LIVE_METRIC_COUNTER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  'b2cac5d7-b9b7-4fcb-89de-3c9a264b866d';
const XOPURE_REALTIME_REVENUE_LINE_CHART_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '17b51f1d-24dd-4fc5-b62f-07b3d168f361';
const XOPURE_LIVE_ACTIVITY_FEED_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  '41f61b3b-ab7a-44df-a22e-4bb62f58021e';

// 12-column grid. Charts default to 6 wide x 6 tall; tables span the full width.
// Object/field names are resolved per-workspace at instantiation; any widget whose
// object does not exist in the current workspace is skipped, so a template never
// produces broken widgets.

const fullWidthRow = (row: number) => ({
  row,
  column: 0,
  rowSpan: 6,
  columnSpan: 12,
});

const leftHalf = (row: number) => ({
  row,
  column: 0,
  rowSpan: 6,
  columnSpan: 6,
});

const rightHalf = (row: number) => ({
  row,
  column: 6,
  rowSpan: 6,
  columnSpan: 6,
});

export const AMBASSADOR_GROWTH_TEMPLATE: DashboardTemplate = {
  key: 'ambassador-growth',
  name: 'Ambassador Growth',
  description:
    'Track ambassador sign-ups, downline growth, and commission performance over time.',
  icon: 'IconUsersGroup',
  tabs: [
    {
      title: 'Overview',
      icon: 'IconChartArcs',
      widgets: [
        {
          type: 'graph',
          visualization: 'aggregate',
          title: 'Total Ambassadors',
          objectNameSingular: 'ambassador',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: leftHalf(0),
        },
        {
          type: 'graph',
          visualization: 'pie',
          title: 'Ambassadors by Status',
          objectNameSingular: 'ambassador',
          groupByFieldName: 'status',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: rightHalf(0),
        },
        {
          type: 'graph',
          visualization: 'line',
          title: 'New Ambassadors Over Time',
          objectNameSingular: 'ambassador',
          groupByFieldName: 'createdAt',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: fullWidthRow(6),
        },
        {
          type: 'recordTable',
          title: 'Recent Ambassadors',
          objectNameSingular: 'ambassador',
          gridPosition: fullWidthRow(12),
        },
      ],
    },
  ],
};

export const CUSTOMER_360_TEMPLATE: DashboardTemplate = {
  key: 'customer-360',
  name: 'Customer 360',
  description:
    'A complete view of XO Pure customers, growth, subscription status, and recent activity.',
  icon: 'IconUsers',
  tabs: [
    {
      title: 'Overview',
      icon: 'IconLayoutDashboard',
      widgets: [
        {
          type: 'graph',
          visualization: 'aggregate',
          title: 'Total Customers',
          objectNameSingular: 'customer',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: leftHalf(0),
        },
        {
          type: 'graph',
          visualization: 'pie',
          title: 'Customers by Subscription',
          objectNameSingular: 'customer',
          groupByFieldName: 'subscriptionStatus',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: rightHalf(0),
        },
        {
          type: 'graph',
          visualization: 'line',
          title: 'Customer Growth',
          objectNameSingular: 'customer',
          groupByFieldName: 'createdAt',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: fullWidthRow(6),
        },
        {
          type: 'recordTable',
          title: 'Recent Customers',
          objectNameSingular: 'customer',
          gridPosition: fullWidthRow(12),
        },
      ],
    },
  ],
};

export const REVENUE_AND_ORDERS_TEMPLATE: DashboardTemplate = {
  key: 'revenue-and-orders',
  name: 'Revenue & Orders',
  description:
    'Monitor order volume, revenue trends, and pipeline value across the business.',
  icon: 'IconCoin',
  tabs: [
    {
      title: 'Revenue',
      icon: 'IconTrendingUp',
      widgets: [
        {
          type: 'graph',
          visualization: 'aggregate',
          title: 'Total Revenue',
          objectNameSingular: 'xoOrder',
          aggregateFieldName: 'totalRetail',
          aggregateOperation: AggregateOperations.SUM,
          gridPosition: leftHalf(0),
        },
        {
          type: 'graph',
          visualization: 'pie',
          title: 'Orders by Status',
          objectNameSingular: 'xoOrder',
          groupByFieldName: 'status',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: rightHalf(0),
        },
        {
          type: 'graph',
          visualization: 'line',
          title: 'Revenue Over Time',
          objectNameSingular: 'xoOrder',
          groupByFieldName: 'orderedAt',
          aggregateFieldName: 'totalRetail',
          aggregateOperation: AggregateOperations.SUM,
          gridPosition: fullWidthRow(6),
        },
        {
          type: 'recordTable',
          title: 'Recent Orders',
          objectNameSingular: 'xoOrder',
          gridPosition: fullWidthRow(12),
        },
      ],
    },
  ],
};

export const LIVE_OPERATIONS_TEMPLATE: DashboardTemplate = {
  key: 'live-operations',
  name: 'Live Operations',
  description:
    'Operational snapshot of recent orders and activity. Real-time Supabase widgets are added in a later phase.',
  icon: 'IconActivityHeartbeat',
  tabs: [
    {
      title: 'Operations',
      icon: 'IconActivity',
      widgets: [
        {
          type: 'graph',
          visualization: 'aggregate',
          title: 'Total Orders',
          objectNameSingular: 'xoOrder',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: leftHalf(0),
        },
        {
          type: 'graph',
          visualization: 'pie',
          title: 'Orders by Status',
          objectNameSingular: 'xoOrder',
          groupByFieldName: 'status',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: rightHalf(0),
        },
        {
          type: 'graph',
          visualization: 'bar',
          title: 'Orders Over Time',
          objectNameSingular: 'xoOrder',
          groupByFieldName: 'orderedAt',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: fullWidthRow(6),
        },
        {
          type: 'frontComponent',
          title: 'Live Supabase Order Count',
          frontComponentUniversalIdentifier:
            XOPURE_LIVE_METRIC_COUNTER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          gridPosition: fullWidthRow(12),
        },
        {
          type: 'frontComponent',
          title: 'Realtime Revenue Trend',
          frontComponentUniversalIdentifier:
            XOPURE_REALTIME_REVENUE_LINE_CHART_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          gridPosition: fullWidthRow(18),
        },
        {
          type: 'frontComponent',
          title: 'Live Order Activity',
          frontComponentUniversalIdentifier:
            XOPURE_LIVE_ACTIVITY_FEED_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          gridPosition: fullWidthRow(24),
        },
        {
          type: 'recordTable',
          title: 'Latest Orders',
          objectNameSingular: 'xoOrder',
          gridPosition: fullWidthRow(30),
        },
      ],
    },
  ],
};

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  AMBASSADOR_GROWTH_TEMPLATE,
  CUSTOMER_360_TEMPLATE,
  REVENUE_AND_ORDERS_TEMPLATE,
  LIVE_OPERATIONS_TEMPLATE,
];
