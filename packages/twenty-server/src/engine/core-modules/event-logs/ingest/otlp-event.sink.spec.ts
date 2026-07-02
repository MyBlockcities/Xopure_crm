import { OtlpEventSink } from 'src/engine/core-modules/event-logs/ingest/otlp-event.sink';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';
import { trace } from '@opentelemetry/api';

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(),
  },
}));

const makePageview = (name: string): WorkspaceEventEnvelope => ({
  table: 'pageview',
  row: { type: 'page', name, properties: {}, timestamp: 't', version: '1' },
});

const makeAppLog = (
  overrides?: Partial<{
    workspaceId: string;
    logicFunctionName: string;
    executionId: string;
  }>,
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
    message: 'hello',
    ...overrides,
  },
});

describe('OtlpEventSink', () => {
  let sink: OtlpEventSink;
  let startSpan: jest.Mock;
  let mockSpans: Array<{
    setAttribute: jest.Mock;
    end: jest.Mock;
  }>;

  beforeEach(() => {
    mockSpans = [];
    startSpan = jest.fn(() => {
      const span = { setAttribute: jest.fn(), end: jest.fn() };

      mockSpans.push(span);

      return span;
    });

    (trace.getTracer as jest.Mock).mockReturnValue({ startSpan });

    sink = new OtlpEventSink();
  });

  it('starts and ends one span per envelope with twenty.event.<table> name', async () => {
    const events = [makePageview('a'), makeAppLog()];

    await sink.write(events);

    expect(startSpan).toHaveBeenCalledTimes(2);
    expect(startSpan).toHaveBeenCalledWith('twenty.event.pageview');
    expect(startSpan).toHaveBeenCalledWith('twenty.event.applicationLog');
    expect(mockSpans[0].end).toHaveBeenCalledTimes(1);
    expect(mockSpans[1].end).toHaveBeenCalledTimes(1);
  });

  it('sets twenty.event.table attribute on each span', async () => {
    await sink.write([makePageview('a'), makeAppLog()]);

    expect(mockSpans[0].setAttribute).toHaveBeenCalledWith(
      'twenty.event.table',
      'pageview',
    );
    expect(mockSpans[1].setAttribute).toHaveBeenCalledWith(
      'twenty.event.table',
      'applicationLog',
    );
  });

  it('sets twenty.workspace.id when the envelope row has workspaceId', async () => {
    await sink.write([makeAppLog({ workspaceId: 'ws-1' })]);

    expect(mockSpans[0].setAttribute).toHaveBeenCalledWith(
      'twenty.workspace.id',
      'ws-1',
    );
  });

  it('omits twenty.workspace.id when the envelope row lacks workspaceId', async () => {
    await sink.write([makePageview('no-ws')]);

    const attributeKeys = mockSpans[0].setAttribute.mock.calls.map(
      (c: string[]) => c[0],
    );

    expect(attributeKeys).not.toContain('twenty.workspace.id');
  });

  it('sets applicationLog function/execution identifiers on applicationLog spans', async () => {
    await sink.write([makeAppLog()]);

    expect(mockSpans[0].setAttribute).toHaveBeenCalledWith(
      'twenty.event.logicFunctionName',
      'myFunction',
    );
    expect(mockSpans[0].setAttribute).toHaveBeenCalledWith(
      'twenty.event.executionId',
      'exec-1',
    );
  });

  it('no-ops on an empty batch', async () => {
    await sink.write([]);

    expect(startSpan).not.toHaveBeenCalled();
    expect(mockSpans).toHaveLength(0);
  });

  describe('sensitive field avoidance', () => {
    it('does not set properties as a span attribute for workspaceEvent rows', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'workspaceEvent',
        row: {
          type: 'track',
          event: 'page_viewed',
          properties: { password: 'hunter2', page: '/admin' },
          timestamp: 't',
          version: '1',
        },
      };

      await sink.write([event]);

      const keys = mockSpans[0].setAttribute.mock.calls.map(
        (c: string[]) => c[0],
      );

      expect(keys).not.toContain('twenty.event.properties');
      expect(keys).not.toContainEqual(expect.stringContaining('password'));
    });

    it('does not set properties as a span attribute for pageview rows', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'pageview',
        row: {
          type: 'page',
          name: 'admin-panel',
          properties: { authorization: 'Bearer x', page: '/admin' },
          timestamp: 't',
          version: '1',
        },
      };

      await sink.write([event]);

      const keys = mockSpans[0].setAttribute.mock.calls.map(
        (c: string[]) => c[0],
      );

      expect(keys).not.toContain('twenty.event.properties');
      expect(keys).not.toContainEqual(expect.stringContaining('authorization'));
    });

    it('does not set properties as a span attribute for objectEvent rows', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'objectEvent',
        row: {
          type: 'track',
          event: 'company.deleted',
          recordId: 'rec-1',
          objectMetadataId: 'obj-1',
          properties: { secret: 'classified', name: 'Acme' },
          timestamp: 't',
          version: '1',
        },
      };

      await sink.write([event]);

      const keys = mockSpans[0].setAttribute.mock.calls.map(
        (c: string[]) => c[0],
      );

      expect(keys).not.toContain('twenty.event.properties');
      expect(keys).not.toContainEqual(expect.stringContaining('secret'));
    });

    it('does not set properties as a span attribute for usageEvent rows', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'usageEvent',
        row: {
          timestamp: 't',
          workspaceId: 'ws-1',
          userWorkspaceId: 'uw-1',
          resourceType: 'api',
          operationType: 'write',
          quantity: 1,
          unit: 'call',
          creditsUsedMicro: 500,
          resourceId: 'res-1',
          resourceContext: 'ctx',
          metadata: { token: 'leaked' },
        },
      };

      await sink.write([event]);

      const keys = mockSpans[0].setAttribute.mock.calls.map(
        (c: string[]) => c[0],
      );

      expect(keys).not.toContain('twenty.event.metadata');
      expect(keys).not.toContain('twenty.event.properties');
      expect(keys).not.toContainEqual(expect.stringContaining('token'));
    });

    it('never sets a raw row field named authorization, cookie, token, secret, password, apiKey, or email', async () => {
      const event: WorkspaceEventEnvelope = {
        table: 'workspaceEvent',
        row: {
          type: 'track',
          event: 'api.call',
          properties: {},
          timestamp: 't',
          version: '1',
        },
      };

      await sink.write([event]);

      const keys = mockSpans[0].setAttribute.mock.calls.map(
        (c: string[]) => c[0],
      );
      const sensitivePrefixes = [
        'authorization',
        'cookie',
        'token',
        'secret',
        'password',
        'apiKey',
        'email',
      ];

      for (const prefix of sensitivePrefixes) {
        expect(
          keys.filter((k: string) => k.includes(prefix)),
        ).toHaveLength(0);
      }
    });

    it('only sets allowlisted twenty.* attributes, not entire row objects', async () => {
      await sink.write([makePageview('test')]);

      const keys = mockSpans[0].setAttribute.mock.calls.map(
        (c: string[]) => c[0],
      );

      for (const key of keys) {
        expect(key).toMatch(/^twenty\./);
      }
    });
  });
});
