import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Resource } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions/incubating";
import { appData } from "@repo/lib";

export const initBrowser = (serviceName: string, env: string) => {
  if (appData.getOTELEnabled()) {
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env,
    });

    // Setup exporters
    const traceExporter = new OTLPTraceExporter({
      url: location.origin + `/otlp/v1/traces`,
      headers: {
        "csrf-token": appData.getCSRFToken(),
      },
    });
    const logExporter = new OTLPLogExporter({
      url: location.origin + `/otlp/v1/logs`,
      headers: {
        "csrf-token": appData.getCSRFToken(),
      },
    });

    // Logs
    const loggerProvider = new LoggerProvider({
      resource,
    });
    loggerProvider.addLogRecordProcessor(
      new BatchLogRecordProcessor(logExporter),
    );

    const logger = loggerProvider.getLogger(serviceName);
    window.__otelLogger = logger;

    // Traces
    const provider = new WebTracerProvider({
      spanProcessors: [new BatchSpanProcessor(traceExporter)],
      resource,
    });

    provider.register({
      contextManager: new ZoneContextManager(),
    });

    // Registering instrumentations
    registerInstrumentations({
      instrumentations: [
        getWebAutoInstrumentations({
          "@opentelemetry/instrumentation-fetch": {
            propagateTraceHeaderCorsUrls: [
              new RegExp(`^(?!${window.location.origin}/media/data/).*$`),
            ],
          },
          "@opentelemetry/instrumentation-xml-http-request": {
            propagateTraceHeaderCorsUrls: [
              new RegExp(`^(?!${window.location.origin}/media/data/).*$`),
            ],
          },
        }),
      ],
    });
  }
};
