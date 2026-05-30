import { v4 as uuidv4 } from 'uuid';

import { type DraftPageLayout } from '@/page-layout/types/DraftPageLayout';
import { type PageLayoutTab } from '@/page-layout/types/PageLayoutTab';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { createDefaultFrontComponentWidget } from '@/page-layout/utils/createDefaultFrontComponentWidget';
import { createDefaultGraphWidget } from '@/page-layout/utils/createDefaultGraphWidget';
import { createDefaultRecordTableWidget } from '@/page-layout/utils/createDefaultRecordTableWidget';
import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { type GraphWidgetTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { type DashboardWidgetTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { type GraphColor } from '@/page-layout/widgets/graph/types/GraphColor';
import { isDefined } from 'twenty-shared/utils';
import {
  AggregateOperations,
  AxisNameDisplay,
  BarChartLayout,
  GraphOrderBy,
  PageLayoutTabLayoutMode,
  PageLayoutType,
  type WidgetConfiguration,
  WidgetConfigurationType,
} from '~/generated-metadata/graphql';

export type ResolveObjectMetadataId = (
  objectNameSingular: string,
) => string | undefined;

export type ResolveFieldMetadataId = (
  objectNameSingular: string,
  fieldName: string,
) => string | undefined;

export type ResolveFrontComponentId = (
  frontComponentUniversalIdentifier: string,
) => string | undefined;

type BuildDraftPageLayoutFromTemplateParams = {
  template: DashboardTemplate;
  pageLayoutId: string;
  resolveObjectMetadataId: ResolveObjectMetadataId;
  resolveFieldMetadataId: ResolveFieldMetadataId;
  resolveFrontComponentId?: ResolveFrontComponentId;
};

const createGraphConfiguration = ({
  widgetTemplate,
  groupByFieldMetadataId,
  aggregateFieldMetadataId,
}: {
  widgetTemplate: GraphWidgetTemplate;
  groupByFieldMetadataId?: string;
  aggregateFieldMetadataId: string;
}): WidgetConfiguration | undefined => {
  const aggregateOperation =
    widgetTemplate.aggregateOperation ?? AggregateOperations.COUNT;
  const visualization = widgetTemplate.visualization ?? 'bar';

  if (
    (visualization === 'bar' ||
      visualization === 'line' ||
      visualization === 'pie') &&
    !isDefined(groupByFieldMetadataId)
  ) {
    return undefined;
  }

  const resolvedGroupByFieldMetadataId = groupByFieldMetadataId ?? '';

  switch (visualization) {
    case 'bar':
      return {
        __typename: 'BarChartConfiguration',
        configurationType: WidgetConfigurationType.BAR_CHART,
        layout: BarChartLayout.VERTICAL,
        displayDataLabel: true,
        displayLegend: true,
        color: 'auto' satisfies GraphColor,
        primaryAxisGroupByFieldMetadataId: resolvedGroupByFieldMetadataId,
        aggregateFieldMetadataId,
        aggregateOperation,
        primaryAxisOrderBy: GraphOrderBy.FIELD_POSITION_ASC,
        axisNameDisplay: AxisNameDisplay.NONE,
      };
    case 'line':
      return {
        __typename: 'LineChartConfiguration',
        configurationType: WidgetConfigurationType.LINE_CHART,
        displayDataLabel: true,
        displayLegend: true,
        color: 'auto' satisfies GraphColor,
        primaryAxisGroupByFieldMetadataId: resolvedGroupByFieldMetadataId,
        aggregateFieldMetadataId,
        aggregateOperation,
        primaryAxisOrderBy: GraphOrderBy.FIELD_POSITION_ASC,
        axisNameDisplay: AxisNameDisplay.NONE,
      };
    case 'pie':
      return {
        __typename: 'PieChartConfiguration',
        configurationType: WidgetConfigurationType.PIE_CHART,
        displayDataLabel: true,
        displayLegend: true,
        color: 'auto' satisfies GraphColor,
        groupByFieldMetadataId: resolvedGroupByFieldMetadataId,
        aggregateFieldMetadataId,
        aggregateOperation,
        orderBy: GraphOrderBy.VALUE_DESC,
      };
    case 'aggregate':
      return {
        __typename: 'AggregateChartConfiguration',
        configurationType: WidgetConfigurationType.AGGREGATE_CHART,
        displayDataLabel: true,
        aggregateFieldMetadataId,
        aggregateOperation,
      };
    case 'gauge':
      return {
        __typename: 'GaugeChartConfiguration',
        configurationType: WidgetConfigurationType.GAUGE_CHART,
        displayDataLabel: true,
        color: 'auto' satisfies GraphColor,
        aggregateFieldMetadataId,
        aggregateOperation,
      };
  }
};

const buildWidgetFromTemplate = ({
  widgetTemplate,
  pageLayoutTabId,
  resolveObjectMetadataId,
  resolveFieldMetadataId,
  resolveFrontComponentId,
}: {
  widgetTemplate: DashboardWidgetTemplate;
  pageLayoutTabId: string;
  resolveObjectMetadataId: ResolveObjectMetadataId;
  resolveFieldMetadataId: ResolveFieldMetadataId;
  resolveFrontComponentId?: ResolveFrontComponentId;
}): PageLayoutWidget | undefined => {
  const widgetId = uuidv4();

  switch (widgetTemplate.type) {
    case 'graph': {
      const objectMetadataId = resolveObjectMetadataId(
        widgetTemplate.objectNameSingular,
      );

      if (!isDefined(objectMetadataId)) {
        return undefined;
      }

      const groupByFieldMetadataId = isDefined(widgetTemplate.groupByFieldName)
        ? resolveFieldMetadataId(
            widgetTemplate.objectNameSingular,
            widgetTemplate.groupByFieldName,
          )
        : undefined;

      const aggregateFieldMetadataId = resolveFieldMetadataId(
        widgetTemplate.objectNameSingular,
        widgetTemplate.aggregateFieldName ?? 'id',
      );

      if (!isDefined(aggregateFieldMetadataId)) {
        return undefined;
      }

      const configuration = createGraphConfiguration({
        widgetTemplate,
        groupByFieldMetadataId,
        aggregateFieldMetadataId,
      });

      if (!isDefined(configuration)) {
        return undefined;
      }

      return {
        ...createDefaultGraphWidget({
          id: widgetId,
          pageLayoutTabId,
          title: widgetTemplate.title,
          gridPosition: widgetTemplate.gridPosition,
          objectMetadataId,
        }),
        configuration,
      };
    }
    case 'recordTable': {
      const objectMetadataId = resolveObjectMetadataId(
        widgetTemplate.objectNameSingular,
      );

      if (!isDefined(objectMetadataId)) {
        return undefined;
      }

      return createDefaultRecordTableWidget({
        id: widgetId,
        pageLayoutTabId,
        title: widgetTemplate.title,
        gridPosition: widgetTemplate.gridPosition,
        objectMetadataId,
      });
    }
    case 'frontComponent': {
      const frontComponentUniversalIdentifier =
        widgetTemplate.frontComponentUniversalIdentifier;
      const frontComponentId =
        widgetTemplate.frontComponentId ??
        (isDefined(frontComponentUniversalIdentifier)
          ? resolveFrontComponentId?.(frontComponentUniversalIdentifier)
          : undefined);

      if (!isDefined(frontComponentId)) {
        return undefined;
      }

      return createDefaultFrontComponentWidget(
        widgetId,
        pageLayoutTabId,
        widgetTemplate.title,
        frontComponentId,
        widgetTemplate.gridPosition,
      );
    }
    default:
      return undefined;
  }
};

export const buildDraftPageLayoutFromTemplate = ({
  template,
  pageLayoutId,
  resolveObjectMetadataId,
  resolveFieldMetadataId,
  resolveFrontComponentId,
}: BuildDraftPageLayoutFromTemplateParams): DraftPageLayout => {
  const nowIso = new Date().toISOString();

  const tabs: PageLayoutTab[] = template.tabs.map((tabTemplate, tabIndex) => {
    const tabId = uuidv4();

    const widgets = tabTemplate.widgets
      .map((widgetTemplate) =>
        buildWidgetFromTemplate({
          widgetTemplate,
          pageLayoutTabId: tabId,
          resolveObjectMetadataId,
          resolveFieldMetadataId,
          resolveFrontComponentId,
        }),
      )
      .filter(isDefined);

    return {
      __typename: 'PageLayoutTab',
      id: tabId,
      title: tabTemplate.title,
      position: tabIndex,
      icon: tabTemplate.icon ?? null,
      isActive: true,
      layoutMode: PageLayoutTabLayoutMode.GRID,
      applicationId: '',
      pageLayoutId,
      widgets,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };
  });

  return {
    id: pageLayoutId,
    name: template.name,
    type: PageLayoutType.DASHBOARD,
    objectMetadataId: null,
    tabs,
    defaultTabToFocusOnMobileAndSidePanelId: tabs[0]?.id ?? null,
  };
};
