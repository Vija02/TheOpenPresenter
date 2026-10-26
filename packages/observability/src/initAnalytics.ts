import { appData } from "@repo/lib";
import posthog from "posthog-js";

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

// Only true once PostHog has actually been initialised
let isAnalyticsEnabled = false;

export const initAnalytics = ({ surface, env }: InitAnalyticsOptions) => {
  // Don't pollute analytics with local development traffic
  if (env === "development") {
    return;
  }

  const key = appData.getAnalyticsKey();

  if (!key) {
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
  isAnalyticsEnabled = true;
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
  if (!isAnalyticsEnabled) {
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
  if (!isAnalyticsEnabled || !hasIdentified) {
    return;
  }

  posthog.reset();
  hasIdentified = false;
};

export const captureEvent = (
  event: string,
  properties?: Record<string, unknown>,
) => {
  if (!isAnalyticsEnabled) {
    return;
  }

  posthog.capture(event, properties);
};

export const captureException = (error: Error) => {
  if (!isAnalyticsEnabled) {
    return;
  }

  posthog.captureException(error);
};
