import { appData } from "@repo/lib";
import posthog, { type CaptureResult } from "posthog-js";

export type AnalyticsSurface = "project" | "remote" | "renderer";

export type InitAnalyticsOptions = {
  surface: AnalyticsSurface;
  env: string;
};

// Most of the time we probably don't want to replay renderer
const isReplayEnabled = (surface: AnalyticsSurface) =>
  surface === "renderer"
    ? appData.getAnalyticsRendererReplayEnabled()
    : appData.getAnalyticsReplayEnabled();

// A cross-origin script that throws without CORS headers surfaces in the
// browser as an opaque "Script error." with no stack and a synthetic
// mechanism. These come from extensions or third-party scripts, carry no
// stack to debug, and reach error tracking as high-severity noise, so we drop
// them before they leave the browser.
const isOpaqueScriptError = (event: CaptureResult): boolean => {
  if (event.event !== "$exception") {
    return false;
  }

  const exceptionList = event.properties?.$exception_list;
  if (!Array.isArray(exceptionList) || exceptionList.length === 0) {
    return false;
  }

  return exceptionList.every((exception) => {
    const frameCount = exception?.stacktrace?.frames?.length ?? 0;
    return exception?.value === "Script error." && frameCount === 0;
  });
};

export const initAnalytics = ({ surface, env }: InitAnalyticsOptions) => {
  const key = appData.getAnalyticsKey();

  if (!key) {
    if (env === "development") {
      console.error(
        new Error(
          "ANALYTICS_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ANALYTICS_KEY is configured",
        ),
      );
    }
    return;
  }

  const replayEnabled = isReplayEnabled(surface);

  posthog.init(key, {
    api_host: appData.getAnalyticsHost(),
    ui_host: appData.getAnalyticsUiHost(),
    defaults: "2025-05-24",
    persistence: "localStorage+cookie",
    disable_session_recording: !replayEnabled,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    // We identify explicitly once the session's user is known.
    person_profiles: "identified_only",
    before_send: (event) => {
      if (!event) {
        return null;
      }

      if (isOpaqueScriptError(event)) {
        return null;
      }

      return {
        ...event,
        properties: {
          ...event.properties,
          surface,
          deployment_env: env,
        },
      };
    },
  });
};

export type IdentifyOptions = {
  userId: string;
  organizationId?: string | null;
  organizationSlug?: string | null;
};

let hasIdentified = false;

export const identifyUser = ({
  userId,
  organizationId,
  organizationSlug,
}: IdentifyOptions) => {
  if (!appData.getAnalyticsKey()) {
    return;
  }

  posthog.identify(userId);
  hasIdentified = true;

  if (organizationId) {
    posthog.group("organization", organizationId, {
      ...(organizationSlug ? { slug: organizationSlug } : {}),
    });
  }
};

export const resetAnalytics = () => {
  if (!appData.getAnalyticsKey() || !hasIdentified) {
    return;
  }

  posthog.reset();
  hasIdentified = false;
};

export const captureEvent = (
  event: string,
  properties?: Record<string, unknown>,
) => {
  if (!appData.getAnalyticsKey()) {
    return;
  }

  posthog.capture(event, properties);
};

export const captureException = (error: Error) => {
  if (!appData.getAnalyticsKey()) {
    return;
  }

  posthog.captureException(error);
};
