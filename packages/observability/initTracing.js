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

    const traceExporter = new OTLPTraceExporter({
      url: `${process.env.OTLP_HOST}/v1/traces`,
    });
    const logExporter = new OTLPLogExporter({
      url: `${process.env.OTLP_HOST}/v1/logs`,
    });
    const sdk = new opentelemetry.NodeSDK({
      traceExporter: traceExporter,
      logExporter: logExporter,
      instrumentations: [getNodeAutoInstrumentations()],
      serviceName: "theopenpresenter-server",
    });

    sdk.start();
    console.error("Successfully setup observability");
  } catch (e) {
    console.error("Failed to setup observability");
  }
} else {
  console.log("The 'OTLP_HOST' env was not set, skipping observability");
}
