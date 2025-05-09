import { initBrowser } from "@repo/observability/initBrowser";

initBrowser(
  "theopenpresenter-remote",
  import.meta.env.DEV ? "development" : "production",
);
