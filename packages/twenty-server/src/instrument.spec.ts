import process from 'process';

// ── Real-dep mocks (package.json exists for all of these) ──────────────

jest.mock('@opentelemetry/api', () => ({
  metrics: {
    setGlobalMeterProvider: jest.fn(),
  },
}));

jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: jest.fn(),
}));

jest.mock('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: jest.fn(),
}));

jest.mock('@opentelemetry/sdk-metrics', () => ({
  AggregationTemporality: { DELTA: 1, CUMULATIVE: 2 },
  ConsoleMetricExporter: jest.fn(),
  MeterProvider: jest.fn(),
  PeriodicExportingMetricReader: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  redisIntegration: jest.fn().mockReturnValue({ name: 'redis' }),
  httpIntegration: jest.fn().mockReturnValue({ name: 'http' }),
  expressIntegration: jest.fn().mockReturnValue({ name: 'express' }),
  graphqlIntegration: jest.fn().mockReturnValue({ name: 'graphql' }),
  postgresIntegration: jest.fn().mockReturnValue({ name: 'postgres' }),
  vercelAIIntegration: jest
    .fn()
    .mockReturnValue({ name: 'vercelAI' }),
  getIsolationScope: jest.fn().mockReturnValue({
    getScopeData: jest.fn().mockReturnValue({ contexts: {} }),
  }),
}));

jest.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: jest.fn().mockReturnValue({ name: 'profiling' }),
}));

// ── Virtual-package mocks (tracing deps not yet in package.json) ───────

jest.mock(
  '@opentelemetry/sdk-node',
  () => ({
    NodeSDK: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    })),
  }),
  { virtual: true },
);

jest.mock(
  '@opentelemetry/exporter-trace-otlp-http',
  () => ({
    OTLPTraceExporter: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '@opentelemetry/auto-instrumentations-node',
  () => ({
    getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
  }),
  { virtual: true },
);

jest.mock(
  '@opentelemetry/resources',
  () => ({
    defaultResource: jest.fn().mockReturnValue({
      merge: jest.fn((resource: Record<string, string>) => resource),
    }),
    resourceFromAttributes: jest.fn().mockImplementation(
      (attrs: Record<string, string>) => attrs,
    ),
  }),
  { virtual: true },
);

jest.mock(
  '@opentelemetry/semantic-conventions',
  () => ({
    ATTR_SERVICE_NAME: 'service.name',
    ATTR_SERVICE_VERSION: 'service.version',
    ATTR_DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  }),
  { virtual: true },
);

// ── Helpers ────────────────────────────────────────────────────────────

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIG_ENV };
  delete process.env.OTEL_SERVICE_NAME;
  delete process.env.OTEL_TRACES_EXPORTER;
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  jest.clearAllMocks();
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

/**
 * Import instrument.ts in a fresh module scope so env-controlled
 * branches re-evaluate per test.  jest.resetModules() + dynamic import
 * is the standard Jest pattern for env-conditional bootstraps.
 */
async function importInstrument() {
  jest.resetModules();
  return await import('./instrument');
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('instrument – OTel tracing bootstrap', () => {
  it('does NOT call NodeSDK.start when no tracing env is set', async () => {
    await importInstrument();

    const { NodeSDK } = jest.requireMock<{
      NodeSDK: jest.Mock;
    }>('@opentelemetry/sdk-node');

    expect(NodeSDK).not.toHaveBeenCalled();
  });

  it('constructs NodeSDK with default OTLP endpoint and resource attrs when OTEL_TRACES_EXPORTER=otlp', async () => {
    process.env.OTEL_TRACES_EXPORTER = 'otlp';

    await importInstrument();

    const { NodeSDK } = jest.requireMock<{
      NodeSDK: jest.Mock;
    }>('@opentelemetry/sdk-node');

    const { OTLPTraceExporter } = jest.requireMock<{
      OTLPTraceExporter: jest.Mock;
    }>('@opentelemetry/exporter-trace-otlp-http');

    const { resourceFromAttributes } = jest.requireMock<{
      resourceFromAttributes: jest.Mock;
    }>('@opentelemetry/resources');

    const { getNodeAutoInstrumentations } = jest.requireMock<{
      getNodeAutoInstrumentations: jest.Mock;
    }>('@opentelemetry/auto-instrumentations-node');

    expect(NodeSDK).toHaveBeenCalledTimes(1);

    // Default OTLP trace endpoint
    expect(OTLPTraceExporter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://127.0.0.1:4318/v1/traces',
      }),
    );

    // Resource with expected service attributes
    expect(resourceFromAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'service.name': expect.any(String),
        'service.version': expect.any(String),
        'deployment.environment': expect.any(String),
      }),
    );

    // Auto-instrumentations registered
    expect(getNodeAutoInstrumentations).toHaveBeenCalled();
  });

  it('uses OTEL_EXPORTER_OTLP_TRACES_ENDPOINT when explicitly set', async () => {
    const customEndpoint = 'https://tempo.example.com:4318/v1/traces';
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = customEndpoint;

    await importInstrument();

    const { OTLPTraceExporter } = jest.requireMock<{
      OTLPTraceExporter: jest.Mock;
    }>('@opentelemetry/exporter-trace-otlp-http');

    expect(OTLPTraceExporter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: customEndpoint,
      }),
    );
  });

  it('calls NodeSDK.shutdown on SIGTERM', async () => {
    process.env.OTEL_TRACES_EXPORTER = 'otlp';

    await importInstrument();

    const { NodeSDK } = jest.requireMock<{
      NodeSDK: jest.Mock;
    }>('@opentelemetry/sdk-node');

    const sdkInstance = NodeSDK.mock.results[0]?.value;
    expect(sdkInstance).toBeDefined();

    // Emit SIGTERM
    process.emit('SIGTERM');

    expect(sdkInstance.shutdown).toHaveBeenCalledTimes(1);
  });
});
