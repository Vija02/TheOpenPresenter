import { initBrowser } from "@repo/observability";

initBrowser(
  "theopenpresenter-renderer",
  import.meta.env.DEV ? "development" : "production",
);
