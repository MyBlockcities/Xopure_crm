import { buildDraftPageLayoutFromTemplate } from '@/dashboards/templates/utils/buildDraftPageLayoutFromTemplate';
import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import {
  AggregateOperations,
  PageLayoutTabLayoutMode,
  PageLayoutType,
} from '~/generated-metadata/graphql';

const TEST_TEMPLATE: DashboardTemplate = {
  key: 'test-template',
  name: 'Test Template',
  description: 'Template used in unit tests',
  icon: 'IconTest',
  tabs: [
    {
      title: 'Overview',
      widgets: [
        {
          type: 'graph',
          title: 'Resolvable Graph',
          objectNameSingular: 'order',
          groupByFieldName: 'createdAt',
          aggregateFieldName: 'amount',
          gridPosition: { row: 0, column: 0, rowSpan: 6, columnSpan: 6 },
        },
        {
          type: 'recordTable',
          title: 'Unresolvable Table',
          objectNameSingular: 'doesNotExist',
          gridPosition: { row: 6, column: 0, rowSpan: 6, columnSpan: 12 },
        },
        {
          type: 'frontComponent',
          title: 'Live Widget',
          frontComponentId: 'front-component-id',
          gridPosition: { row: 0, column: 6, rowSpan: 6, columnSpan: 6 },
        },
      ],
    },
  ],
};

const VISUALIZATIONS_TEMPLATE: DashboardTemplate = {
  key: 'visualizations-template',
  name: 'Visualizations Template',
  description: 'Template covering every graph visualization',
  icon: 'IconChartBar',
  tabs: [
    {
      title: 'Charts',
      widgets: [
        {
          type: 'graph',
          visualization: 'bar',
          title: 'Bar',
          objectNameSingular: 'order',
          groupByFieldName: 'createdAt',
          aggregateFieldName: 'amount',
          aggregateOperation: AggregateOperations.SUM,
          gridPosition: { row: 0, column: 0, rowSpan: 6, columnSpan: 6 },
        },
        {
          type: 'graph',
          visualization: 'line',
          title: 'Line',
          objectNameSingular: 'order',
          groupByFieldName: 'createdAt',
          aggregateFieldName: 'amount',
          aggregateOperation: AggregateOperations.SUM,
          gridPosition: { row: 0, column: 6, rowSpan: 6, columnSpan: 6 },
        },
        {
          type: 'graph',
          visualization: 'pie',
          title: 'Pie',
          objectNameSingular: 'order',
          groupByFieldName: 'status',
          aggregateFieldName: 'id',
          aggregateOperation: AggregateOperations.COUNT,
          gridPosition: { row: 6, column: 0, rowSpan: 6, columnSpan: 6 },
        },
        {
          type: 'graph',
          visualization: 'aggregate',
          title: 'Aggregate',
          objectNameSingular: 'order',
          aggregateFieldName: 'amount',
          aggregateOperation: AggregateOperations.SUM,
          gridPosition: { row: 6, column: 6, rowSpan: 6, columnSpan: 3 },
        },
        {
          type: 'graph',
          visualization: 'gauge',
          title: 'Gauge',
          objectNameSingular: 'order',
          aggregateFieldName: 'amount',
          aggregateOperation: AggregateOperations.SUM,
          gridPosition: { row: 6, column: 9, rowSpan: 6, columnSpan: 3 },
        },
      ],
    },
  ],
};

describe('buildDraftPageLayoutFromTemplate', () => {
  const resolveObjectMetadataId = (objectNameSingular: string) =>
    objectNameSingular === 'order' ? 'order-object-id' : undefined;

  const resolveFieldMetadataId = (
    objectNameSingular: string,
    fieldName: string,
  ) =>
    objectNameSingular === 'order'
      ? {
          id: 'order-id-id',
          createdAt: 'order-created-at-id',
          amount: 'order-amount-id',
          status: 'order-status-id',
        }[fieldName]
      : undefined;

  it('builds a dashboard draft page layout with grid tabs', () => {
    const draft = buildDraftPageLayoutFromTemplate({
      template: TEST_TEMPLATE,
      pageLayoutId: 'page-layout-id',
      resolveObjectMetadataId,
      resolveFieldMetadataId,
    });

    expect(draft.id).toBe('page-layout-id');
    expect(draft.type).toBe(PageLayoutType.DASHBOARD);
    expect(draft.tabs).toHaveLength(1);
    expect(draft.tabs[0].layoutMode).toBe(PageLayoutTabLayoutMode.GRID);
    expect(draft.defaultTabToFocusOnMobileAndSidePanelId).toBe(
      draft.tabs[0].id,
    );
  });

  it('skips widgets whose object cannot be resolved but keeps front components', () => {
    const draft = buildDraftPageLayoutFromTemplate({
      template: TEST_TEMPLATE,
      pageLayoutId: 'page-layout-id',
      resolveObjectMetadataId,
      resolveFieldMetadataId,
    });

    const widgets = draft.tabs[0].widgets;

    // graph (resolvable) + frontComponent are kept; the record table is skipped.
    expect(widgets).toHaveLength(2);
    expect(widgets.map((widget) => widget.title)).toEqual([
      'Resolvable Graph',
      'Live Widget',
    ]);
  });

  it('assigns all widgets to their tab id', () => {
    const draft = buildDraftPageLayoutFromTemplate({
      template: TEST_TEMPLATE,
      pageLayoutId: 'page-layout-id',
      resolveObjectMetadataId,
      resolveFieldMetadataId,
    });

    const tabId = draft.tabs[0].id;

    draft.tabs[0].widgets.forEach((widget) => {
      expect(widget.pageLayoutTabId).toBe(tabId);
    });
  });

  it('builds typed configurations for every graph visualization', () => {
    const draft = buildDraftPageLayoutFromTemplate({
      template: VISUALIZATIONS_TEMPLATE,
      pageLayoutId: 'page-layout-id',
      resolveObjectMetadataId,
      resolveFieldMetadataId,
    });

    expect(
      draft.tabs[0].widgets.map(
        (widget) => widget.configuration?.__typename,
      ),
    ).toEqual([
      'BarChartConfiguration',
      'LineChartConfiguration',
      'PieChartConfiguration',
      'AggregateChartConfiguration',
      'GaugeChartConfiguration',
    ]);
  });

  it('skips graph widgets when a required field cannot be resolved', () => {
    const draft = buildDraftPageLayoutFromTemplate({
      template: {
        ...TEST_TEMPLATE,
        tabs: [
          {
            title: 'Overview',
            widgets: [
              {
                type: 'graph',
                visualization: 'line',
                title: 'Broken Graph',
                objectNameSingular: 'order',
                groupByFieldName: 'missingField',
                aggregateFieldName: 'amount',
                gridPosition: {
                  row: 0,
                  column: 0,
                  rowSpan: 6,
                  columnSpan: 6,
                },
              },
            ],
          },
        ],
      },
      pageLayoutId: 'page-layout-id',
      resolveObjectMetadataId,
      resolveFieldMetadataId,
    });

    expect(draft.tabs[0].widgets).toHaveLength(0);
  });

  it('resolves installed front components by universal identifier', () => {
    const draft = buildDraftPageLayoutFromTemplate({
      template: {
        ...TEST_TEMPLATE,
        tabs: [
          {
            title: 'Live',
            widgets: [
              {
                type: 'frontComponent',
                title: 'Resolved Live Widget',
                frontComponentUniversalIdentifier:
                  'front-component-universal-id',
                gridPosition: {
                  row: 0,
                  column: 0,
                  rowSpan: 6,
                  columnSpan: 12,
                },
              },
            ],
          },
        ],
      },
      pageLayoutId: 'page-layout-id',
      resolveObjectMetadataId,
      resolveFieldMetadataId,
      resolveFrontComponentId: (universalIdentifier) =>
        universalIdentifier === 'front-component-universal-id'
          ? 'front-component-id'
          : undefined,
    });

    expect(draft.tabs[0].widgets[0].configuration).toEqual({
      __typename: 'FrontComponentConfiguration',
      configurationType: 'FRONT_COMPONENT',
      frontComponentId: 'front-component-id',
    });
  });
});
