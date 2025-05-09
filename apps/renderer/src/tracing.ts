import { initBrowser } from "@repo/observability/initBrowser";

initBrowser(
  "theopenpresenter-renderer",
  import.meta.env.DEV ? "development" : "production",
);
