import type { DashboardBlueprint } from './dashboard-blueprint.type';

export const telemetryLoggingDashboardBlueprint: DashboardBlueprint = {
  title: 'Telemetry & Logging Dashboard',
  tabs: [
    {
      key: 'telemetry-logging',
      title: 'Telemetry & Logging',
      position: 0,
      widgets: [
        {
          title: 'Sync Health',
          type: 'GRAPH',
          objectNameSingular: 'xopureSyncMap',
          gridPosition: { row: 0, column: 0, rowSpan: 2, columnSpan: 3 },
          configuration: {
            configurationType: 'AGGREGATE_CHART',
            aggregateFieldName: 'id',
            aggregateOperation: 'COUNT',
            label: 'Total sync maps',
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
            label: 'Failed',
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
          gridPosition: { row: 0, column: 6, rowSpan: 4, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldName: 'id',
            aggregateOperation: 'COUNT',
            groupByFieldName: 'lastStatus',
            orderBy: 'VALUE_DESC',
            displayDataLabel: true,
            displayLegend: true,
            hideEmptyCategory: true,
          },
        },
        {
          title: 'Cursor Run Status',
          type: 'GRAPH',
          objectNameSingular: 'xopureSyncCursor',
          gridPosition: { row: 4, column: 0, rowSpan: 4, columnSpan: 6 },
          configuration: {
            configurationType: 'PIE_CHART',
            aggregateFieldName: 'id',
            aggregateOperation: 'COUNT',
            groupByFieldName: 'lastRunStatus',
            orderBy: 'VALUE_DESC',
            displayDataLabel: true,
            displayLegend: true,
            hideEmptyCategory: true,
          },
        },
        {
          title: 'Sync Map Error Summary',
          type: 'RECORD_TABLE',
          objectNameSingular: 'xopureSyncMap',
          gridPosition: { row: 8, column: 0, rowSpan: 6, columnSpan: 12 },
          view: {
            name: 'Sync Map Error Summary',
            icon: 'IconAlertTriangle',
            fields: [
              { fieldName: 'syncKey', position: 0, size: 220 },
              { fieldName: 'sourceTable', position: 1, size: 140 },
              { fieldName: 'lastStatus', position: 2, size: 130 },
              { fieldName: 'lastErrorSummary', position: 3, size: 300 },
              { fieldName: 'lastSyncedAt', position: 4, size: 160 },
            ],
          },
        },
        {
          title: 'Support Ticket Tasks',
          type: 'RECORD_TABLE',
          objectNameSingular: 'xopureSupportTicket',
          gridPosition: { row: 14, column: 0, rowSpan: 6, columnSpan: 12 },
          view: {
            name: 'Support Ticket Tasks',
            icon: 'IconLifebuoy',
            fields: [
              { fieldName: 'ticketNumber', position: 0, size: 120 },
              { fieldName: 'subject', position: 1, size: 240 },
              { fieldName: 'status', position: 2, size: 120 },
              { fieldName: 'priority', position: 3, size: 100 },
              { fieldName: 'multicaIssueId', position: 4, size: 120 },
              { fieldName: 'lastActivityAt', position: 5, size: 160 },
            ],
          },
        },
      ],
    },
  ],
};
