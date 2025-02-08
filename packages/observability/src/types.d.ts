import type { Logger } from "@opentelemetry/api-logs";

declare global {
  interface Window {
    __otelLogger: Logger;
  }
}
