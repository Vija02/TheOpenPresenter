import { initBrowser } from "@repo/observability/initBrowser";

initBrowser(
  "theopenpresenter-project",
  import.meta.env.DEV ? "development" : "production",
);
