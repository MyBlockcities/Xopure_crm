import {
  AggregateOperations,
  definePageLayout,
  ObjectRecordGroupByDateGranularity,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';
import {
  XOPURE_AMBASSADOR_ATTRIBUTED_REVENUE_FIELD_ID,
  XOPURE_AMBASSADOR_LEVEL_FIELD_ID,
  XOPURE_AMBASSADOR_NAME_FIELD_ID,
  XOPURE_AMBASSADOR_OBJECT_ID,
  XOPURE_AMBASSADOR_TOTAL_COMMISSION_EARNED_FIELD_ID,
} from 'src/objects/xopure-ambassador.object';
import {
  XOPURE_CUSTOMER_NAME_FIELD_ID,
  XOPURE_CUSTOMER_OBJECT_ID,
  XOPURE_CUSTOMER_STATUS_FIELD_ID,
} from 'src/objects/xopure-customer.object';
import {
  XOPURE_ORDER_NUMBER_FIELD_ID,
  XOPURE_ORDER_OBJECT_ID,
  XOPURE_ORDER_ORDERED_AT_FIELD_ID,
  XOPURE_ORDER_STATUS_FIELD_ID,
  XOPURE_ORDER_TOTAL_FIELD_ID,
} from 'src/objects/xopure-order.object';
import {
  XOPURE_PRODUCT_CATEGORY_FIELD_ID,
  XOPURE_PRODUCT_NAME_FIELD_ID,
  XOPURE_PRODUCT_OBJECT_ID,
  XOPURE_PRODUCT_STATUS_FIELD_ID,
} from 'src/objects/xopure-product.object';
import { XOPURE_LIVE_ACTIVITY_FEED_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/live-activity-feed.front-component';
import { XOPURE_LIVE_METRIC_COUNTER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/live-metric-counter.front-component';
import { XOPURE_REALTIME_REVENUE_LINE_CHART_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/front-components/realtime-revenue-line-chart.front-component';

export const XOPURE_MISSION_CONTROL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER =
  'e6f68d07-7b42-4bf5-8e16-9e4e6e02ab0a';
export const XOPURE_MISSION_CONTROL_NAVIGATION_MENU_ITEM_NAME =
  'XO Pure Mission Control';

const COMMON_CHART_CONFIGURATION = {
  timezone: 'UTC',
  firstDayOfTheWeek: 0,
};

export default definePageLayout({
  universalIdentifier: XOPURE_MISSION_CONTROL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: XOPURE_MISSION_CONTROL_NAVIGATION_MENU_ITEM_NAME,
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: 'd922d119-a173-4dc1-8787-a0aa2e6071e1',
      title: 'Growth & Revenue',
      position: 0,
      icon: 'IconTrendingUp',
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier: '5f45265e-bf0b-43cf-b114-82bb1ce0ff28',
          title: 'Live Supabase Order Count',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 0, column: 0, rowSpan: 4, columnSpan: 3 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              XOPURE_LIVE_METRIC_COUNTER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
        {
          universalIdentifier: 'ad8a2081-0bb3-44da-b57f-e3d972ee5523',
          title: 'CRM Revenue',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_ORDER_OBJECT_ID,
          gridPosition: { row: 0, column: 3, rowSpan: 4, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_ORDER_TOTAL_FIELD_ID,
            aggregateOperation: AggregateOperations.SUM,
            label: 'Revenue',
            prefix: '$',
            color: 'green',
            displayDataLabel: false,
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '242f47c1-e1c2-4f65-b8e5-6ce563773a45',
          title: 'Total Customers',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_CUSTOMER_OBJECT_ID,
          gridPosition: { row: 0, column: 6, rowSpan: 4, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_CUSTOMER_NAME_FIELD_ID,
            aggregateOperation: AggregateOperations.COUNT,
            label: 'Customers',
            color: 'blue',
            displayDataLabel: false,
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '13998457-7345-44f5-95a9-117d63e25e19',
          title: 'Total Ambassadors',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
          gridPosition: { row: 0, column: 9, rowSpan: 4, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_AMBASSADOR_NAME_FIELD_ID,
            aggregateOperation: AggregateOperations.COUNT,
            label: 'Ambassadors',
            color: 'purple',
            displayDataLabel: false,
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '3fe10192-53c8-4fc6-91e4-79b6c36e7983',
          title: 'Realtime Revenue Trend',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 4, column: 0, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              XOPURE_REALTIME_REVENUE_LINE_CHART_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
        {
          universalIdentifier: 'b687bc14-8116-444e-9b44-59c07591f8b2',
          title: 'Orders Over Time',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_ORDER_OBJECT_ID,
          gridPosition: { row: 4, column: 6, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'LINE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_ORDER_TOTAL_FIELD_ID,
            aggregateOperation: AggregateOperations.SUM,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              XOPURE_ORDER_ORDERED_AT_FIELD_ID,
            primaryAxisDateGranularity:
              ObjectRecordGroupByDateGranularity.DAY,
            displayDataLabel: false,
            displayLegend: false,
            omitNullValues: true,
            color: 'green',
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '4e4fb5c5-4b07-48d8-bffc-7413dd1488b7',
          title: 'Orders by Status',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_ORDER_OBJECT_ID,
          gridPosition: { row: 10, column: 0, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_ORDER_NUMBER_FIELD_ID,
            aggregateOperation: AggregateOperations.COUNT,
            groupByFieldMetadataUniversalIdentifier:
              XOPURE_ORDER_STATUS_FIELD_ID,
            displayDataLabel: true,
            displayLegend: true,
            showCenterMetric: true,
            color: 'blue',
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '6b78319f-a32c-425b-a6bc-894e57ae3de9',
          title: 'Ambassador Level Mix',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
          gridPosition: { row: 10, column: 6, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_AMBASSADOR_NAME_FIELD_ID,
            aggregateOperation: AggregateOperations.COUNT,
            groupByFieldMetadataUniversalIdentifier:
              XOPURE_AMBASSADOR_LEVEL_FIELD_ID,
            displayDataLabel: true,
            displayLegend: true,
            showCenterMetric: true,
            color: 'purple',
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: 'f1301340-02d1-4fab-82c4-181fe79f687f',
          title: 'Latest XO Pure Orders',
          type: 'RECORD_TABLE',
          objectUniversalIdentifier: XOPURE_ORDER_OBJECT_ID,
          gridPosition: { row: 16, column: 0, rowSpan: 8, columnSpan: 12 },
          configuration: {
            configurationType: 'RECORD_TABLE',
          },
        },
      ],
    },
    {
      universalIdentifier: 'c7f90a7a-0d93-4a4e-950d-54b4c38df209',
      title: 'Operations',
      position: 1,
      icon: 'IconActivityHeartbeat',
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        {
          universalIdentifier: 'aa3e4e63-ea29-49e8-a5dd-04acfdb83b45',
          title: 'Live Order Activity',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 0, column: 0, rowSpan: 10, columnSpan: 6 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              XOPURE_LIVE_ACTIVITY_FEED_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
        {
          universalIdentifier: '205bb639-a73a-43da-aa64-e2e1db0d61bc',
          title: 'Commission Earned',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
          gridPosition: { row: 0, column: 6, rowSpan: 4, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_AMBASSADOR_TOTAL_COMMISSION_EARNED_FIELD_ID,
            aggregateOperation: AggregateOperations.SUM,
            label: 'Commission',
            prefix: '$',
            color: 'green',
            displayDataLabel: false,
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '234e10fa-e14d-4fed-b222-50a9377a27c0',
          title: 'Attributed Revenue',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
          gridPosition: { row: 0, column: 9, rowSpan: 4, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_AMBASSADOR_ATTRIBUTED_REVENUE_FIELD_ID,
            aggregateOperation: AggregateOperations.SUM,
            label: 'Attributed Revenue',
            prefix: '$',
            color: 'turquoise',
            displayDataLabel: false,
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '0f28e10e-60e7-4c8f-abf4-801076ec0f3a',
          title: 'Customer Status Mix',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_CUSTOMER_OBJECT_ID,
          gridPosition: { row: 4, column: 6, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_CUSTOMER_NAME_FIELD_ID,
            aggregateOperation: AggregateOperations.COUNT,
            groupByFieldMetadataUniversalIdentifier:
              XOPURE_CUSTOMER_STATUS_FIELD_ID,
            displayDataLabel: true,
            displayLegend: true,
            showCenterMetric: true,
            color: 'blue',
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: 'a96c0db5-f93b-49b9-b04d-e279696210b0',
          title: 'Products by Status',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_PRODUCT_OBJECT_ID,
          gridPosition: { row: 10, column: 0, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_PRODUCT_NAME_FIELD_ID,
            aggregateOperation: AggregateOperations.COUNT,
            groupByFieldMetadataUniversalIdentifier:
              XOPURE_PRODUCT_STATUS_FIELD_ID,
            displayDataLabel: true,
            displayLegend: true,
            showCenterMetric: true,
            color: 'orange',
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '1e9e3b3d-bbc5-4276-bcd3-2296951a9e09',
          title: 'Products by Category',
          type: 'GRAPH',
          objectUniversalIdentifier: XOPURE_PRODUCT_OBJECT_ID,
          gridPosition: { row: 10, column: 6, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'BAR_CHART',
            aggregateFieldMetadataUniversalIdentifier:
              XOPURE_PRODUCT_NAME_FIELD_ID,
            aggregateOperation: AggregateOperations.COUNT,
            primaryAxisGroupByFieldMetadataUniversalIdentifier:
              XOPURE_PRODUCT_CATEGORY_FIELD_ID,
            displayDataLabel: true,
            displayLegend: false,
            layout: 'VERTICAL',
            color: 'orange',
            ...COMMON_CHART_CONFIGURATION,
          },
        },
        {
          universalIdentifier: '42410c7b-a102-4d88-b4c3-358ca295d338',
          title: 'Recent Ambassadors',
          type: 'RECORD_TABLE',
          objectUniversalIdentifier: XOPURE_AMBASSADOR_OBJECT_ID,
          gridPosition: { row: 16, column: 0, rowSpan: 8, columnSpan: 12 },
          configuration: {
            configurationType: 'RECORD_TABLE',
          },
        },
        {
          universalIdentifier: '62fa9f69-ddd4-412b-93dd-f173513647c5',
          title: 'Product Catalog',
          type: 'RECORD_TABLE',
          objectUniversalIdentifier: XOPURE_PRODUCT_OBJECT_ID,
          gridPosition: { row: 24, column: 0, rowSpan: 8, columnSpan: 12 },
          configuration: {
            configurationType: 'RECORD_TABLE',
          },
        },
      ],
    },
  ],
});
