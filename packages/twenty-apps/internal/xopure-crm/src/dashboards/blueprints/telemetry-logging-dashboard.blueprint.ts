import type { DashboardBlueprint } from './dashboard-blueprint.type';

export const telemetryLoggingDashboardBlueprint: DashboardBlueprint = {
  title: 'Telemetry & Logging Dashboard',
  tabs: [
    {
      key: 'sync-health',
      title: 'Sync Health',
      position: 0,
      widgets: [
        {
          title: 'Sync Map Count',
          type: 'GRAPH',
          objectNameSingular: 'xopureSyncMap',
          gridPosition: { row: 0, column: 0, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldName: 'id',
            aggregateOperation: 'COUNT',
            label: 'Sync maps',
            displayDataLabel: true,
          },
        },
        {
          title: 'Failed Sync Maps',
          type: 'GRAPH',
          objectNameSingular: 'xopureSyncMap',
          gridPosition: { row: 0, column: 3, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldName: 'id',
            aggregateOperation: 'COUNT',
            label: 'Failures',
            displayDataLabel: true,
            filter: {
              lastStatus: { in: ['FAILED_RETRYABLE', 'FAILED_PERMANENT'] },
            },
          },
        },
        {
          title: 'Sync Status Distribution',
          type: 'GRAPH',
          objectNameSingular: 'xopureSyncMap',
          gridPosition: { row: 2, column: 0, rowSpan: 4, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldName: 'id',
            aggregateOperation: 'COUNT',
            groupByFieldName: 'lastStatus',
            orderBy: 'VALUE_DESC',
            displayDataLabel: true,
            hideEmptyCategory: true,
          },
        },
        {
          title: 'Cursor Run Status',
          type: 'GRAPH',
          objectNameSingular: 'xopureSyncCursor',
          gridPosition: { row: 2, column: 6, rowSpan: 4, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldName: 'id',
            aggregateOperation: 'COUNT',
            groupByFieldName: 'lastRunStatus',
            orderBy: 'VALUE_DESC',
            displayDataLabel: true,
            hideEmptyCategory: true,
          },
        },
        {
          title: 'Sync Map Errors',
          type: 'RECORD_TABLE',
          objectNameSingular: 'xopureSyncMap',
          gridPosition: { row: 6, column: 0, rowSpan: 6, columnSpan: 12 },
          view: {
            name: 'Sync Map Errors',
            icon: 'IconAlertTriangle',
            fields: [
              { fieldName: 'syncKey', position: 0, size: 260 },
              { fieldName: 'sourceTable', position: 1, size: 150 },
              { fieldName: 'sourceRecordId', position: 2, size: 180 },
              { fieldName: 'targetObject', position: 3, size: 180 },
              { fieldName: 'lastStatus', position: 4, size: 160 },
              { fieldName: 'lastErrorSummary', position: 5, size: 260 },
              { fieldName: 'lastSyncedAt', position: 6, size: 180 },
            ],
          },
        },
        {
          title: 'Support Ticket Sync Visibility',
          type: 'RECORD_TABLE',
          objectNameSingular: 'xopureSupportTicket',
          gridPosition: { row: 12, column: 0, rowSpan: 6, columnSpan: 12 },
          view: {
            name: 'Support Ticket Sync Visibility',
            icon: 'IconLifebuoy',
            fields: [
              { fieldName: 'ticketNumber', position: 0, size: 130 },
              { fieldName: 'status', position: 1, size: 130 },
              { fieldName: 'priority', position: 2, size: 120 },
              { fieldName: 'subject', position: 3, size: 240 },
              { fieldName: 'lastActivityAt', position: 4, size: 180 },
              { fieldName: 'lastSyncedAt', position: 5, size: 180 },
            ],
          },
        },
      ],
    },
  ],
};
