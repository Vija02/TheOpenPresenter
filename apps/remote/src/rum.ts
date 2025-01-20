import { openobserveRum } from "@openobserve/browser-rum";

const options = {
  clientToken: import.meta.env.VITE_APP_OPENOBSERVE_CLIENT_TOKEN,
  site: import.meta.env.VITE_APP_OPENOBSERVE_SITE,
  organizationIdentifier: import.meta.env
    .VITE_APP_OPENOBSERVE_ORGANIZATION_IDENTIFIER,
  applicationId: "theopenpresenter",
  service: "theopenpresenter-remote",
  env: import.meta.env.DEV ? "development" : "production",
  version: import.meta.env.VITE_APP_SHA,
  insecureHTTP: false,
  apiVersion: "v1",
};

openobserveRum.init({
  applicationId: options.applicationId,
  clientToken: options.clientToken,
  site: options.site,
  organizationIdentifier: options.organizationIdentifier,
  service: options.service,
  env: options.env,
  version: options.version,
  trackResources: true,
  trackLongTasks: true,
  trackUserInteractions: true,
  apiVersion: options.apiVersion,
  insecureHTTP: options.insecureHTTP,
  defaultPrivacyLevel: "allow",
});

openobserveRum.startSessionReplayRecording();
