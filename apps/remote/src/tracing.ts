import { appData } from "@repo/lib";
import { initBrowser } from "@repo/observability/initBrowser";

initBrowser(
  "theopenpresenter-remote",
  appData.getDeploymentEnv() ??
    (import.meta.env.DEV ? "development" : "production"),
);
