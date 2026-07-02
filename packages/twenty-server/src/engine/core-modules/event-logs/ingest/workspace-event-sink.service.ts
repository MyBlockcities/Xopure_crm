import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  EVENT_SINKS,
  type EventSink,
} from 'src/engine/core-modules/event-logs/ingest/event-sink';
import { EventLogLiveService } from 'src/engine/core-modules/event-logs/live/event-log-live.service';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';

@Injectable()
export class WorkspaceEventSinkService {
  private readonly logger = new Logger(WorkspaceEventSinkService.name);

  constructor(
    @Inject(EVENT_SINKS)
    private readonly sinks: EventSink[],
    private readonly workspaceEventLiveService: EventLogLiveService,
  ) {}

  isEnabled(): boolean {
    return this.sinks.length > 0;
  }

  async ingest(events: WorkspaceEventEnvelope[]): Promise<void> {
    await this.persist(events);
    await this.workspaceEventLiveService.publishWatched(events);
  }

  private async persist(events: WorkspaceEventEnvelope[]): Promise<void> {
    const results = await Promise.allSettled(
      this.sinks.map((sink) => sink.write(events)),
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        return;
      }

      const sinkName = this.sinks[index]?.constructor?.name ?? 'UnknownSink';
      const reason =
        result.reason instanceof Error
          ? result.reason.stack
          : JSON.stringify(result.reason);

      this.logger.error(
        `Event sink ${sinkName} failed; continuing with remaining sinks`,
        reason,
      );
    });
  }
}
