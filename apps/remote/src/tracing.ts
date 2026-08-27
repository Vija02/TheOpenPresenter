import { appData } from "@repo/lib";
import { initAnalytics } from "@repo/observability/initAnalytics";
import { initBrowser } from "@repo/observability/initBrowser";

const env =
  appData.getDeploymentEnv() ??
  (import.meta.env.DEV ? "development" : "production");

initBrowser("theopenpresenter-remote", env);

initAnalytics({ surface: "remote", env });
