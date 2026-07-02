import { Logger } from '@nestjs/common';

import { ConsoleEventSink } from 'src/engine/core-modules/event-logs/ingest/console-event.sink';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';

const makeAppLog = (
  overrides?: Partial<WorkspaceEventEnvelope>,
): WorkspaceEventEnvelope => ({
  table: 'applicationLog',
  row: {
    timestamp: 't',
    workspaceId: 'w',
    applicationId: 'app-1',
    logicFunctionId: 'func-1',
    logicFunctionName: 'myFunction',
    executionId: 'exec-1',
    level: 'INFO',
    message: 'hello world',
    ...overrides,
  },
}) as WorkspaceEventEnvelope;

const makePageview = (
  overrides?: Partial<WorkspaceEventEnvelope>,
): WorkspaceEventEnvelope => ({
  table: 'pageview',
  row: {
    type: 'page',
    name: 'test-page',
    properties: {},
    timestamp: 't',
    version: '1',
    ...overrides,
  },
}) as WorkspaceEventEnvelope;

describe('ConsoleEventSink', () => {
  let sink: ConsoleEventSink;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    debugSpy = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {});

    sink = new ConsoleEventSink();
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });

  describe('applicationLog events', () => {
    it('logs ERROR level messages via logger.error with context', async () => {
      await sink.write([makeAppLog({ level: 'ERROR', message: 'boom' })]);

      expect(errorSpy).toHaveBeenCalledWith(
        'boom',
        undefined,
        'myFunction:exec-1',
      );
    });

    it('logs WARN level messages via logger.warn with context', async () => {
      await sink.write([makeAppLog({ level: 'WARN', message: 'caution' })]);

      expect(warnSpy).toHaveBeenCalledWith('caution', 'myFunction:exec-1');
    });

    it('logs DEBUG level messages via logger.debug with context', async () => {
      await sink.write([makeAppLog({ level: 'DEBUG', message: 'trace' })]);

      expect(debugSpy).toHaveBeenCalledWith('trace', 'myFunction:exec-1');
    });

    it('logs default level messages via logger.log with context', async () => {
      await sink.write([makeAppLog({ level: 'INFO', message: 'hello' })]);

      expect(logSpy).toHaveBeenCalledWith('hello', 'myFunction:exec-1');
    });

    it('logs unknown level messages via logger.log with context', async () => {
      await sink.write([makeAppLog({ level: 'TRACE', message: 'unknown' })]);

      expect(logSpy).toHaveBeenCalledWith('unknown', 'myFunction:exec-1');
    });
  });

  describe('non-application events — scrubbed payload logging', () => {
    it('logs pageview rows as JSON with the table name as context', async () => {
      await sink.write([makePageview({ name: 'home' })]);

      expect(logSpy).toHaveBeenCalledWith(
        expect.any(String),
        'pageview',
      );
    });

    it('logs workspaceEvent rows as JSON with the table name as context', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'workspaceEvent',
        row: {
          type: 'track',
          event: 'page_viewed',
          workspaceId: 'ws-1',
          properties: { page: 'home' },
          timestamp: 't',
          version: '1',
        },
      };

      await sink.write([event]);

      expect(logSpy).toHaveBeenCalledWith(expect.any(String), 'workspaceEvent');
    });

    it('logs objectEvent rows as JSON with the table name as context', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'objectEvent',
        row: {
          type: 'track',
          event: 'company.created',
          recordId: 'rec-1',
          objectMetadataId: 'obj-1',
          properties: {},
          timestamp: 't',
          version: '1',
        },
      };

      await sink.write([event]);

      expect(logSpy).toHaveBeenCalledWith(expect.any(String), 'objectEvent');
    });

    it('logs usageEvent rows as JSON with the table name as context', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'usageEvent',
        row: {
          timestamp: 't',
          workspaceId: 'ws-1',
          userWorkspaceId: 'uw-1',
          resourceType: 'api-call',
          operationType: 'read',
          quantity: 1,
          unit: 'count',
          creditsUsedMicro: 100,
          resourceId: 'res-1',
          resourceContext: 'ctx',
          metadata: {},
        },
      };

      await sink.write([event]);

      expect(logSpy).toHaveBeenCalledWith(expect.any(String), 'usageEvent');
    });

    it('logs scrubbed row JSON — sensitive fields are not in the logged string', async () => {
      const event = makePageview({
        name: 'login',
        properties: { password: 'hunter2' },
      });

      await sink.write([event]);

      const loggedJson = logSpy.mock.calls[0][0] as string;

      expect(loggedJson).toContain('[REDACTED]');
      expect(loggedJson).not.toContain('hunter2');
    });

    it('logs scrubbed row JSON — sensitive top-level fields are not in the logged string', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'workspaceEvent',
        row: {
          type: 'track',
          event: 'api.call',
          properties: {
            endpoint: '/api/data',
            authorization: 'Bearer secret123',
          },
          timestamp: 't',
          version: '1',
        },
      };

      await sink.write([event]);

      const loggedJson = logSpy.mock.calls[0][0] as string;

      expect(loggedJson).not.toContain('Bearer');
      expect(loggedJson).not.toContain('secret123');
      expect(loggedJson).toContain('/api/data');
    });

    it('preserves safe fields in logged JSON', async () => {
      const event = makePageview({
        name: 'dashboard',
        properties: { page: '/dashboard', referrer: '/login' },
      });

      await sink.write([event]);

      const loggedJson = logSpy.mock.calls[0][0] as string;

      expect(loggedJson).toContain('/dashboard');
      expect(loggedJson).toContain('/login');
    });

    it('handles empty batch without logging anything', async () => {
      await sink.write([]);

      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('handles batch with both app and non-app events', async () => {
      await sink.write([
        makeAppLog({ level: 'ERROR', message: 'err' }),
        makePageview({ name: 'page' }),
      ]);

      expect(errorSpy).toHaveBeenCalledWith('err', undefined, 'myFunction:exec-1');
      expect(logSpy).toHaveBeenCalledWith(expect.any(String), 'pageview');
    });
  });
});
