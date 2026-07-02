import { Injectable } from '@nestjs/common';
import { trace, type Span } from '@opentelemetry/api';

import { type EventSink } from 'src/engine/core-modules/event-logs/ingest/event-sink';
import { scrubEventPayload } from 'src/engine/core-modules/event-logs/ingest/event-payload-scrubber';
import {
  type WorkspaceEventEnvelope,
  type WorkspaceEventTable,
} from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';

type SpanAttributeValue = string | number | boolean;

@Injectable()
export class OtlpEventSink implements EventSink {
  private readonly tracer = trace.getTracer('twenty-event-logs');

  async write(events: WorkspaceEventEnvelope[]): Promise<void> {
    for (const event of events) {
      const scrubbedEvent = {
        ...event,
        row: scrubEventPayload(event.row) as WorkspaceEventEnvelope['row'],
      } as WorkspaceEventEnvelope;
      const span = this.tracer.startSpan(`twenty.event.${scrubbedEvent.table}`);

      try {
        this.setAttributes(span, scrubbedEvent);
      } finally {
        span.end();
      }
    }
  }

  private setAttributes(
    span: Span,
    event: WorkspaceEventEnvelope,
  ): void {
    for (const [key, value] of Object.entries(this.getAttributes(event))) {
      span.setAttribute(key, value);
    }
  }

  private getAttributes(
    event: WorkspaceEventEnvelope,
  ): Record<string, SpanAttributeValue> {
    return {
      'twenty.event.table': event.table,
      ...this.getCommonRowAttributes(event),
      ...this.getTableAttributes(event),
    };
  }

  private getCommonRowAttributes(
    event: WorkspaceEventEnvelope,
  ): Record<string, SpanAttributeValue> {
    const row = event.row as Record<string, unknown>;

    return {
      ...this.getStringAttribute('twenty.workspace.id', row.workspaceId),
      ...this.getStringAttribute('twenty.user.id', row.userId),
      ...this.getStringAttribute('twenty.event.type', row.type),
      ...this.getStringAttribute('twenty.event.timestamp', row.timestamp),
      ...this.getStringAttribute('twenty.event.version', row.version),
    };
  }

  private getTableAttributes(
    event: WorkspaceEventEnvelope,
  ): Record<string, SpanAttributeValue> {
    switch (event.table) {
      case 'workspaceEvent':
        return {
          ...this.getStringAttribute(
            'twenty.event.name',
            event.row.event,
          ),
        };
      case 'pageview':
        return {
          ...this.getStringAttribute(
            'twenty.event.page.name',
            event.row.name,
          ),
        };
      case 'objectEvent':
        return {
          ...this.getStringAttribute(
            'twenty.event.name',
            event.row.event,
          ),
          ...this.getStringAttribute(
            'twenty.object.metadataId',
            event.row.objectMetadataId,
          ),
          ...this.getStringAttribute(
            'twenty.object.recordId',
            event.row.recordId,
          ),
          ...this.getBooleanAttribute(
            'twenty.object.isCustom',
            event.row.isCustom,
          ),
        };
      case 'usageEvent':
        return {
          ...this.getStringAttribute(
            'twenty.event.resourceType',
            event.row.resourceType,
          ),
          ...this.getStringAttribute(
            'twenty.event.operationType',
            event.row.operationType,
          ),
          ...this.getNumberAttribute(
            'twenty.event.quantity',
            event.row.quantity,
          ),
          ...this.getNumberAttribute(
            'twenty.event.creditsUsedMicro',
            event.row.creditsUsedMicro,
          ),
        };
      case 'applicationLog':
        return {
          ...this.getStringAttribute(
            'twenty.event.applicationId',
            event.row.applicationId,
          ),
          ...this.getStringAttribute(
            'twenty.event.logicFunctionId',
            event.row.logicFunctionId,
          ),
          ...this.getStringAttribute(
            'twenty.event.logicFunctionName',
            event.row.logicFunctionName,
          ),
          ...this.getStringAttribute(
            'twenty.event.executionId',
            event.row.executionId,
          ),
          ...this.getStringAttribute('twenty.event.level', event.row.level),
        };
      default:
        event.table satisfies never;

        return this.getUnhandledTableAttributes(event.table);
    }
  }

  private getUnhandledTableAttributes(
    table: WorkspaceEventTable,
  ): Record<string, SpanAttributeValue> {
    return {
      'twenty.event.unhandledTable': table,
    };
  }

  private getStringAttribute(
    key: string,
    value: unknown,
  ): Record<string, string> {
    return typeof value === 'string' && value.length > 0
      ? { [key]: value }
      : {};
  }

  private getNumberAttribute(
    key: string,
    value: unknown,
  ): Record<string, number> {
    return typeof value === 'number' ? { [key]: value } : {};
  }

  private getBooleanAttribute(
    key: string,
    value: unknown,
  ): Record<string, boolean> {
    return typeof value === 'boolean' ? { [key]: value } : {};
  }
}
