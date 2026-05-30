import {
  type AggregateOperations,
  type GridPosition,
} from '~/generated-metadata/graphql';

// Templates reference objects by their singular name and fields by their name so
// that definitions stay decoupled from workspace-specific metadata ids. Ids are
// resolved at instantiation time; widgets whose object cannot be resolved in the
// current workspace are skipped gracefully rather than creating broken widgets.

type BaseWidgetTemplate = {
  title: string;
  gridPosition: GridPosition;
};

export type GraphWidgetTemplate = BaseWidgetTemplate & {
  type: 'graph';
  visualization?: 'bar' | 'line' | 'pie' | 'aggregate' | 'gauge';
  objectNameSingular: string;
  groupByFieldName?: string;
  aggregateFieldName?: string;
  aggregateOperation?: AggregateOperations;
};

export type RecordTableWidgetTemplate = BaseWidgetTemplate & {
  type: 'recordTable';
  objectNameSingular: string;
};

export type FrontComponentWidgetTemplate = BaseWidgetTemplate &
  {
    type: 'frontComponent';
  } & (
    | {
        frontComponentId: string;
        frontComponentUniversalIdentifier?: never;
      }
    | {
        frontComponentId?: never;
        frontComponentUniversalIdentifier: string;
      }
  );

export type DashboardWidgetTemplate =
  | GraphWidgetTemplate
  | RecordTableWidgetTemplate
  | FrontComponentWidgetTemplate;

export type DashboardTabTemplate = {
  title: string;
  icon?: string;
  widgets: DashboardWidgetTemplate[];
};

export type DashboardTemplate = {
  key: string;
  name: string;
  description: string;
  icon: string;
  tabs: DashboardTabTemplate[];
};
