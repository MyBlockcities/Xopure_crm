import { describe, expect, it } from 'vitest';

import { telemetryLoggingDashboardBlueprint } from './telemetry-logging-dashboard.blueprint';

const findWidget = (title: string) => {
  const widget = telemetryLoggingDashboardBlueprint.tabs
    .flatMap((tab) => tab.widgets)
    .find((candidate) => candidate.title === title);

  if (!widget) {
    throw new Error(`Widget not found: ${title}`);
  }

  return widget;
};

const fieldsForTable = (title: string): string[] => {
  const widget = findWidget(title);

  if (widget.type !== 'RECORD_TABLE') {
    throw new Error(`Widget is not a record table: ${title}`);
  }

  return widget.view.fields.map((field) => field.fieldName);
};

describe('telemetryLoggingDashboardBlueprint', () => {
  it('contains sync health, failed sync, cursor, and support visibility widgets', () => {
    expect(telemetryLoggingDashboardBlueprint.title).toBe(
      'Telemetry & Logging Dashboard',
    );
    expect(telemetryLoggingDashboardBlueprint.tabs).toHaveLength(1);
    expect(telemetryLoggingDashboardBlueprint.tabs[0]?.widgets).toHaveLength(6);

    expect(findWidget('Sync Map Count')).toMatchObject({
      type: 'GRAPH',
      objectNameSingular: 'xopureSyncMap',
    });
    expect(findWidget('Failed Sync Maps')).toMatchObject({
      type: 'GRAPH',
      objectNameSingular: 'xopureSyncMap',
      configuration: expect.objectContaining({
        configurationType: 'AGGREGATE_CHART',
        filter: {
          lastStatus: { in: ['FAILED_RETRYABLE', 'FAILED_PERMANENT'] },
        },
      }),
    });
    expect(findWidget('Cursor Run Status')).toMatchObject({
      type: 'GRAPH',
      objectNameSingular: 'xopureSyncCursor',
    });
  });

  it('uses existing support ticket and sync object fields only', () => {
    expect(fieldsForTable('Sync Map Errors')).toEqual([
      'syncKey',
      'sourceTable',
      'sourceRecordId',
      'targetObject',
      'lastStatus',
      'lastErrorSummary',
      'lastSyncedAt',
    ]);
    expect(fieldsForTable('Support Ticket Sync Visibility')).toEqual([
      'ticketNumber',
      'status',
      'priority',
      'subject',
      'lastActivityAt',
      'lastSyncedAt',
    ]);
  });
});
