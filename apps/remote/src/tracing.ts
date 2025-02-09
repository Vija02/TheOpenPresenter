import { initBrowser } from "@repo/observability";

initBrowser(
  "theopenpresenter-remote",
  import.meta.env.DEV ? "development" : "production",
);
