import { SeverityNumber } from "@opentelemetry/api-logs";
import pino from "pino";

// Mapping taken from OTEL pino instrumentation
const DEFAULT_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const OTEL_SEV_NUM_FROM_PINO_LEVEL: { [level: number]: SeverityNumber } = {
  [DEFAULT_LEVELS.trace]: SeverityNumber.TRACE,
  [DEFAULT_LEVELS.debug]: SeverityNumber.DEBUG,
  [DEFAULT_LEVELS.info]: SeverityNumber.INFO,
  [DEFAULT_LEVELS.warn]: SeverityNumber.WARN,
  [DEFAULT_LEVELS.error]: SeverityNumber.ERROR,
  [DEFAULT_LEVELS.fatal]: SeverityNumber.FATAL,
};

// @ts-ignore
const isTestEnv = typeof vitest !== "undefined";
const isDevEnv = process.env.NODE_ENV === "development";
const isBrowser = typeof window !== "undefined";

const getNodeDestination = () => {
  if (isDevEnv) {
    // In dev mode, use pino-pretty for nice console output
    return pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    });
  }
  // In production, silence logs (OTEL instrumentation handles them)
  return process.platform === "win32"
    ? pino.destination(require("os").tmpdir() + "/nul")
    : pino.destination("/dev/null");
};

const logger = pino(
  {
    // TODO: Make level configurable
    level: "trace",
    serializers: { ...pino.stdSerializers, error: pino.stdSerializers.err },
    browser: {
      serialize: true,
      write: ({ msg, time, level, ...attributes }: any) => {
        if (window.__otelLogger) {
          window.__otelLogger.emit({
            body: msg,
            timestamp: time,
            severityNumber: OTEL_SEV_NUM_FROM_PINO_LEVEL[level],
            attributes,
          });
        }
      },
    },
  },
  // In Node, the destination will be instrumented by opentelemetry
  // So setting the destination to /dev/null stops it from logging to the console
  // Browser doesn't have pino.destination, so we can just pass undefined
  isBrowser && !isTestEnv ? undefined : getNodeDestination(),
);

export { logger };
