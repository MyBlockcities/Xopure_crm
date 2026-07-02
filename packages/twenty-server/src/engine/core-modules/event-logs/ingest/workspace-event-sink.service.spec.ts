jest.mock('src/engine/core-modules/event-logs/live/event-log-live.service', () => ({
  EventLogLiveService: jest.fn(),
}));

import { Logger } from '@nestjs/common';

import { WorkspaceEventSinkService } from 'src/engine/core-modules/event-logs/ingest/workspace-event-sink.service';
import { type EventSink } from 'src/engine/core-modules/event-logs/ingest/event-sink';
import type { EventLogLiveService } from 'src/engine/core-modules/event-logs/live/event-log-live.service';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';

const makeEnvelope = (
  overrides?: Partial<WorkspaceEventEnvelope>,
): WorkspaceEventEnvelope =>
  ({
    table: 'pageview',
    row: {
      type: 'page',
      name: 'test',
      properties: {},
      timestamp: 't',
      version: '1',
    },
    ...overrides,
  }) as WorkspaceEventEnvelope;

const buildFakeLiveService = (
): jest.Mocked<Pick<EventLogLiveService, 'publishWatched'>> => ({
  publishWatched: jest.fn().mockResolvedValue(undefined),
});

describe('WorkspaceEventSinkService', () => {
  describe('fault isolation — single sink rejection', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('calls all sinks even when one rejects', async () => {
      const sinkA: EventSink = { write: jest.fn().mockResolvedValue(undefined) };
      const sinkB: EventSink = { write: jest.fn().mockRejectedValue(new Error('boom')) };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sinkA, sinkB],
        live as unknown as EventLogLiveService,
      );
      const events = [makeEnvelope()];

      await service.ingest(events);

      expect(sinkA.write).toHaveBeenCalledWith(events);
      expect(sinkB.write).toHaveBeenCalledWith(events);
    });

    it('still calls publishWatched when a sink rejects', async () => {
      const failingSink: EventSink = {
        write: jest.fn().mockRejectedValue(new Error('disk full')),
      };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [failingSink],
        live as unknown as EventLogLiveService,
      );
      const events = [makeEnvelope()];

      await service.ingest(events);

      expect(live.publishWatched).toHaveBeenCalledWith(events);
    });

    it('does not throw when a sink rejects', async () => {
      const failingSink: EventSink = {
        write: jest.fn().mockRejectedValue(new Error('timeout')),
      };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [failingSink],
        live as unknown as EventLogLiveService,
      );

      await expect(service.ingest([makeEnvelope()])).resolves.toBeUndefined();
    });

    it('logs the sink failure reason as a string instead of throwing', async () => {
      const failingSink: EventSink = {
        write: jest.fn().mockRejectedValue(new Error('connection refused')),
      };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [failingSink],
        live as unknown as EventLogLiveService,
      );

      await service.ingest([makeEnvelope()]);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.stringContaining('connection refused'),
      );
    });
  });

  describe('fault isolation — multiple sink rejections', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('calls all sinks and publishWatched when all sinks reject', async () => {
      const sinkA: EventSink = { write: jest.fn().mockRejectedValue(new Error('a')) };
      const sinkB: EventSink = { write: jest.fn().mockRejectedValue(new Error('b')) };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sinkA, sinkB],
        live as unknown as EventLogLiveService,
      );
      const events = [makeEnvelope()];

      await service.ingest(events);

      expect(sinkA.write).toHaveBeenCalledWith(events);
      expect(sinkB.write).toHaveBeenCalledWith(events);
      expect(live.publishWatched).toHaveBeenCalledWith(events);
    });

    it('does not throw when all sinks reject', async () => {
      const sinkA: EventSink = { write: jest.fn().mockRejectedValue(new Error('a')) };
      const sinkB: EventSink = { write: jest.fn().mockRejectedValue(new Error('b')) };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sinkA, sinkB],
        live as unknown as EventLogLiveService,
      );

      await expect(service.ingest([makeEnvelope()])).resolves.toBeUndefined();
    });

    it('logs every sink failure', async () => {
      const sinkA: EventSink = { write: jest.fn().mockRejectedValue(new Error('a')) };
      const sinkB: EventSink = { write: jest.fn().mockRejectedValue(new Error('b')) };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sinkA, sinkB],
        live as unknown as EventLogLiveService,
      );

      await service.ingest([makeEnvelope()]);

      expect(errorSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('happy path', () => {
    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    it('calls all sinks and publishWatched when no sink rejects', async () => {
      const sink: EventSink = { write: jest.fn().mockResolvedValue(undefined) };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sink],
        live as unknown as EventLogLiveService,
      );
      const events = [makeEnvelope()];

      await service.ingest(events);

      expect(sink.write).toHaveBeenCalledWith(events);
      expect(live.publishWatched).toHaveBeenCalledWith(events);
    });

    it('passes all envelopes to each sink', async () => {
      const sink: EventSink = { write: jest.fn().mockResolvedValue(undefined) };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sink],
        live as unknown as EventLogLiveService,
      );
      const events = [
        makeEnvelope({ table: 'pageview' }),
        makeEnvelope({ table: 'applicationLog' }),
      ];

      await service.ingest(events);

      expect(sink.write).toHaveBeenCalledWith(events);
    });

    it('does not log errors when no sink rejects', async () => {
      const localSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const sink: EventSink = { write: jest.fn().mockResolvedValue(undefined) };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sink],
        live as unknown as EventLogLiveService,
      );

      await service.ingest([makeEnvelope()]);

      expect(localSpy).not.toHaveBeenCalled();
      localSpy.mockRestore();
    });
  });

  describe('call sequencing', () => {
    it('waits for all sinks to settle before calling publishWatched', async () => {
      const calls: string[] = [];
      const sinkA: EventSink = {
        write: jest.fn().mockImplementation(async () => {
          calls.push('sinkA');
        }),
      };
      const live = buildFakeLiveService();
      live.publishWatched.mockImplementation(async () => {
        calls.push('publishWatched');
      });
      const service = new WorkspaceEventSinkService(
        [sinkA],
        live as unknown as EventLogLiveService,
      );

      await service.ingest([makeEnvelope()]);

      expect(calls).toEqual(['sinkA', 'publishWatched']);
    });
  });

  describe('isEnabled', () => {
    it('returns true when sinks are registered', () => {
      const sink: EventSink = { write: jest.fn() };
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [sink],
        live as unknown as EventLogLiveService,
      );

      expect(service.isEnabled()).toBe(true);
    });

    it('returns false when no sinks are registered', () => {
      const live = buildFakeLiveService();
      const service = new WorkspaceEventSinkService(
        [],
        live as unknown as EventLogLiveService,
      );

      expect(service.isEnabled()).toBe(false);
    });
  });
});
