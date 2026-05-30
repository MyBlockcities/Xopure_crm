import { isWidgetConfigurationOfType } from '@/side-panel/pages/page-layout/utils/isWidgetConfigurationOfType';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { assertIsDefinedOrThrow } from 'twenty-shared/utils';
import { type GaugeChartConfiguration } from '~/generated-metadata/graphql';

type AssertGaugeChartWidgetOrThrow = (
  widget: PageLayoutWidget,
) => asserts widget is PageLayoutWidget & {
  objectMetadataId: string;
  configuration: GaugeChartConfiguration;
};

export const assertGaugeChartWidgetOrThrow: AssertGaugeChartWidgetOrThrow = (
  widget: PageLayoutWidget,
) => {
  assertIsDefinedOrThrow(
    widget.objectMetadataId,
    new Error('Widget objectMetadataId is required'),
  );

  if (
    !isWidgetConfigurationOfType(widget.configuration, 'GaugeChartConfiguration')
  ) {
    throw new Error(
      `Expected GaugeChartConfiguration but got ${widget.configuration?.__typename}`,
    );
  }
};
