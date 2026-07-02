import { Injectable, Logger } from '@nestjs/common';

import { type EventSink } from 'src/engine/core-modules/event-logs/ingest/event-sink';
import { scrubEventPayload } from 'src/engine/core-modules/event-logs/ingest/event-payload-scrubber';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';

@Injectable()
export class ConsoleEventSink implements EventSink {
  private readonly logger = new Logger(ConsoleEventSink.name);

  async write(events: WorkspaceEventEnvelope[]): Promise<void> {
    for (const event of events) {
      const row = scrubEventPayload(event.row) as typeof event.row;

      if (event.table === 'applicationLog') {
        const context = `${row.logicFunctionName}:${row.executionId}`;

        switch (row.level) {
          case 'ERROR':
            this.logger.error(row.message, undefined, context);
            break;
          case 'WARN':
            this.logger.warn(row.message, context);
            break;
          case 'DEBUG':
            this.logger.debug(row.message, context);
            break;
          default:
            this.logger.log(row.message, context);
            break;
        }
      } else {
        this.logger.log(JSON.stringify(row), event.table);
      }
    }
  }
}
