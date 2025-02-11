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

const logger = pino(
  {
    // TODO: Make configurable
    level: "trace",
    browser: {
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
  typeof window !== "undefined" && !isTestEnv
    ? undefined
    : pino.destination("/dev/null"),
);

export { logger };
