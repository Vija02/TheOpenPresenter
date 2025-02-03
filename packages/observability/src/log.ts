import pino from "pino";

// This will be instrumented by opentelemetry
// So setting the destination to /dev/null stops it from logging to the console
const logger = pino({}, pino.destination("/dev/null"));

export { logger };
