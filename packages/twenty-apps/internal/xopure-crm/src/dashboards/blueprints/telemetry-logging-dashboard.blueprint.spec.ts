import { describe, expect, it } from 'vitest';

import type { DashboardGraphWidgetBlueprint } from './dashboard-blueprint.type';
import { telemetryLoggingDashboardBlueprint } from './telemetry-logging-dashboard.blueprint';

type AggregateChartConfiguration = Extract<
  DashboardGraphWidgetBlueprint['configuration'],
  { configurationType: 'AGGREGATE_CHART' }
>;

type PieChartConfiguration = Extract<
  DashboardGraphWidgetBlueprint['configuration'],
  { configurationType: 'PIE_CHART' }
>;

const graphConfigurationFor = (
  widgetTitle: string,
): DashboardGraphWidgetBlueprint['configuration'] => {
  for (const tab of telemetryLoggingDashboardBlueprint.tabs) {
    for (const widget of tab.widgets) {
      if (widget.type === 'GRAPH' && widget.title === widgetTitle) {
        return widget.configuration;
      }
    }
  }

  throw new Error(`Graph widget not found: ${widgetTitle}`);
};

const fieldsForView = (viewName: string): string[] => {
  for (const tab of telemetryLoggingDashboardBlueprint.tabs) {
    for (const widget of tab.widgets) {
      if (widget.type === 'RECORD_TABLE' && widget.view.name === viewName) {
        return widget.view.fields.map((field) => field.fieldName);
      }
    }
  }

  throw new Error(`View not found: ${viewName}`);
};

describe('telemetryLoggingDashboardBlueprint', () => {
  it('counts total sync maps in Sync Health aggregate chart', () => {
    const config = graphConfigurationFor('Sync Health') as AggregateChartConfiguration;

    expect(config.configurationType).toBe('AGGREGATE_CHART');
    expect(config.aggregateFieldName).toBe('id');
    expect(config.aggregateOperation).toBe('COUNT');
    // Sync Health must not carry a filter — it should count ALL sync maps.
    expect(config).not.toHaveProperty('filter');
  });

  it('filters Failed Sync Maps to retryable and permanent failures', () => {
    const config = graphConfigurationFor('Failed Sync Maps') as AggregateChartConfiguration;

    expect(config.configurationType).toBe('AGGREGATE_CHART');
    expect(config.filter).toMatchObject({
      lastStatus: { in: ['FAILED_RETRYABLE', 'FAILED_PERMANENT'] },
    });
  });

  it('groups Sync Status Distribution pie chart by lastStatus', () => {
    const config = graphConfigurationFor('Sync Status Distribution') as PieChartConfiguration;

    expect(config.configurationType).toBe('PIE_CHART');
    expect(config.groupByFieldName).toBe('lastStatus');
    expect(config.hideEmptyCategory).toBe(true);
  });

  it('groups Cursor Run Status pie chart by lastRunStatus', () => {
    const config = graphConfigurationFor('Cursor Run Status') as PieChartConfiguration;

    expect(config.configurationType).toBe('PIE_CHART');
    expect(config.groupByFieldName).toBe('lastRunStatus');
    expect(config.hideEmptyCategory).toBe(true);
  });

  it('exposes error summary fields in Sync Map Error Summary table', () => {
    const fieldNames = fieldsForView('Sync Map Error Summary');

    expect(fieldNames).toEqual(
      expect.arrayContaining(['lastErrorSummary', 'lastStatus', 'lastSyncedAt']),
    );
  });

  it('exposes task visibility fields in Support Ticket Tasks table', () => {
    const fieldNames = fieldsForView('Support Ticket Tasks');

    expect(fieldNames).toEqual(
      expect.arrayContaining([
        'ticketNumber',
        'subject',
        'status',
        'priority',
        'multicaIssueId',
        'lastActivityAt',
      ]),
    );
  });

  it('registers exactly 6 widgets across one tab', () => {
    expect(telemetryLoggingDashboardBlueprint.tabs).toHaveLength(1);
    expect(telemetryLoggingDashboardBlueprint.tabs[0].widgets).toHaveLength(6);
  });
});
