const { BatchLogRecordProcessor } = require("@opentelemetry/sdk-logs");
const { Resource } = require("@opentelemetry/resources");
const { ATTR_SERVICE_NAME } = require("@opentelemetry/semantic-conventions");
const {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} = require("@opentelemetry/semantic-conventions/incubating");
const opentelemetry = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto");
const { OTLPLogExporter } = require("@opentelemetry/exporter-logs-otlp-proto");

if (process.env.OTLP_HOST) {
  try {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: "theopenpresenter-server",
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV,
    });

    const traceExporter = new OTLPTraceExporter({
      url: `${process.env.OTLP_HOST}/v1/traces`,
    });
    const logExporter = new OTLPLogExporter({
      url: `${process.env.OTLP_HOST}/v1/logs`,
    });
    const sdk = new opentelemetry.NodeSDK({
      traceExporter: traceExporter,
      logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
      instrumentations: [getNodeAutoInstrumentations()],
      resource,
    });

    sdk.start();
    console.error("Successfully setup observability");
  } catch (e) {
    console.error("Failed to setup observability");
  }
} else {
  console.log("The 'OTLP_HOST' env was not set, skipping observability");
}
