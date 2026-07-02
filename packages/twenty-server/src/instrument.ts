import process from 'process';

import { metrics as otelMetrics } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  AggregationTemporality,
  ConsoleMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

import { NodeEnvironment } from 'src/engine/core-modules/twenty-config/interfaces/node-environment.interface';

import { ExceptionHandlerDriver } from 'src/engine/core-modules/exception-handler/interfaces';
import { MeterDriver } from 'src/engine/core-modules/metrics/types/meter-driver.type';
import { parseArrayEnvVar } from 'src/utils/parse-array-env-var';

const meterDrivers = parseArrayEnvVar(
  process.env.METER_DRIVER,
  Object.values(MeterDriver),
  [],
);

const DEFAULT_OTLP_TRACE_ENDPOINT = 'http://127.0.0.1:4318/v1/traces';

const hasOtlpTraceExporter = () =>
  parseArrayEnvVar(process.env.OTEL_TRACES_EXPORTER, ['otlp'], []).includes(
    'otlp',
  );

const getOtlpTraceEndpoint = () => {
  if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
    return process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  }

  if (hasOtlpTraceExporter()) {
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      return `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`;
    }

    return DEFAULT_OTLP_TRACE_ENDPOINT;
  }

  return null;
};

const otlpTraceEndpoint = getOtlpTraceEndpoint();

if (otlpTraceEndpoint) {
  const tracingSdk = new NodeSDK({
    resource: defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'twenty-server',
        [ATTR_SERVICE_VERSION]: process.env.APP_VERSION ?? 'unknown',
        [ATTR_DEPLOYMENT_ENVIRONMENT]:
          process.env.SENTRY_ENVIRONMENT ??
          process.env.NODE_ENV ??
          NodeEnvironment.DEVELOPMENT,
      }),
    ),
    traceExporter: new OTLPTraceExporter({
      url: otlpTraceEndpoint,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  tracingSdk.start();

  process.once('SIGTERM', () => {
    void tracingSdk.shutdown();
  });
}

if (process.env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.SENTRY) {
  Sentry.init({
    environment: process.env.SENTRY_ENVIRONMENT,
    release: process.env.APP_VERSION,
    dsn: process.env.SENTRY_DSN,
    integrations: [
      Sentry.redisIntegration(),
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.graphqlIntegration(),
      Sentry.postgresIntegration(),
      Sentry.vercelAIIntegration({
        recordInputs: true,
        recordOutputs: true,
      }),
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.3,
    sendDefaultPii: false,
    debug: process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT,
    beforeSendSpan: (span) => {
      const twentyContext = Sentry.getIsolationScope().getScopeData().contexts
        ?.twenty as
        | {
            workspace_id?: string;
            user_workspace_id?: string;
          }
        | undefined;

      if (!twentyContext?.workspace_id) {
        return span;
      }

      span.data = {
        ...span.data,
        'twenty.workspace.id': twentyContext.workspace_id,
        ...(twentyContext.user_workspace_id && {
          'twenty.user_workspace.id': twentyContext.user_workspace_id,
        }),
      };

      return span;
    },
  });
}

// Meter setup

const prometheusExporter = meterDrivers.includes(MeterDriver.Prometheus)
  ? new PrometheusExporter({ port: 9464 })
  : null;

const meterProvider = new MeterProvider({
  readers: [
    ...(meterDrivers.includes(MeterDriver.Console)
      ? [
          new PeriodicExportingMetricReader({
            exporter: new ConsoleMetricExporter(),
            exportIntervalMillis: 10000,
          }),
        ]
      : []),
    ...(meterDrivers.includes(MeterDriver.OpenTelemetry)
      ? [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: process.env.OTLP_COLLECTOR_METRICS_ENDPOINT_URL,
              temporalityPreference: AggregationTemporality.DELTA,
            }),
            exportIntervalMillis: 10000,
          }),
        ]
      : []),
    ...(prometheusExporter ? [prometheusExporter] : []),
  ],
});

otelMetrics.setGlobalMeterProvider(meterProvider);
