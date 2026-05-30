import { useAggregateRecords } from '@/object-record/hooks/useAggregateRecords';
import { convertAggregateOperationToExtendedAggregateOperation } from '@/object-record/utils/convertAggregateOperationToExtendedAggregateOperation';
import { WidgetSkeletonLoader } from '@/page-layout/widgets/components/WidgetSkeletonLoader';
import { deriveGaugeMax } from '@/page-layout/widgets/graph/graph-widget-gauge-chart/utils/deriveGaugeMax';
import { useGraphWidgetQueryCommon } from '@/page-layout/widgets/graph/hooks/useGraphWidgetQueryCommon';
import { type GraphColor } from '@/page-layout/widgets/graph/types/GraphColor';
import { assertGaugeChartWidgetOrThrow } from '@/page-layout/widgets/graph/utils/assertGaugeChartWidget';
import { useCurrentWidget } from '@/page-layout/widgets/hooks/useCurrentWidget';
import { lazy, Suspense } from 'react';
import { isDefined } from 'twenty-shared/utils';

const GraphWidgetGaugeChart = lazy(() =>
  import(
    '@/page-layout/widgets/graph/graph-widget-gauge-chart/components/GraphWidgetGaugeChart'
  ).then((module) => ({
    default: module.GraphWidgetGaugeChart,
  })),
);

export const GraphWidgetGaugeChartRenderer = () => {
  const widget = useCurrentWidget();

  assertGaugeChartWidgetOrThrow(widget);

  const configuration = widget.configuration;

  const { objectMetadataItem, gqlOperationFilter, aggregateField } =
    useGraphWidgetQueryCommon({
      objectMetadataItemId: widget.objectMetadataId,
      configuration,
    });

  const aggregateOperation = configuration.aggregateOperation;
  const extendedAggregateOperation =
    convertAggregateOperationToExtendedAggregateOperation(
      aggregateOperation,
      aggregateField.type,
    );

  const { data, loading } = useAggregateRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordGqlFieldsAggregate: {
      [aggregateField.name]: [extendedAggregateOperation],
    },
    filter: gqlOperationFilter,
  });

  if (loading) {
    return <WidgetSkeletonLoader />;
  }

  // No persisted goal/range model exists on GaugeChartConfiguration yet, so the
  // upper bound is derived from the aggregate value. See deriveGaugeMax.
  const rawValue = data?.[aggregateField.name]?.[aggregateOperation];
  const numericValue = Number(rawValue ?? 0);
  const value = Number.isFinite(numericValue) ? numericValue : 0;

  return (
    <Suspense fallback={<WidgetSkeletonLoader />}>
      <GraphWidgetGaugeChart
        id={widget.id}
        data={{
          value,
          min: 0,
          max: deriveGaugeMax(value),
          color: isDefined(configuration.color)
            ? (configuration.color as GraphColor)
            : undefined,
          label: aggregateField.label,
        }}
      />
    </Suspense>
  );
};
