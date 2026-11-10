import { appData } from "@repo/lib";
import { useEffect, useState } from "react";

/**
 * Whether AI works for an organization, and what the user can do when it does
 * not. Mirrors `AiStatus` in @repo/base-plugin/server.
 */
export type AiStatus =
  | { state: "available" }
  | { state: "connect"; actionUrl: string | null }
  | { state: "reconnect"; actionUrl: string | null }
  | { state: "offline" }
  | { state: "upgrade"; actionUrl: string };

export type AiStatusView = {
  message: string;
  action?: { label: string; url: string };
};

/** What to tell the user, or null when AI works. */
export const describeAiStatus = (status: AiStatus): AiStatusView | null => {
  switch (status.state) {
    case "available":
      return null;
    case "connect":
      return {
        message: "AI works through TheOpenPresenter Cloud.",
        action: status.actionUrl
          ? { label: "Connect to Cloud", url: status.actionUrl }
          : undefined,
      };
    case "reconnect":
      return {
        message: "Your cloud sign-in has expired.",
        action: status.actionUrl
          ? { label: "Reconnect", url: status.actionUrl }
          : undefined,
      };
    case "offline":
      return { message: "AI needs an internet connection." };
    case "upgrade":
      return {
        message: "Your plan doesn't include AI.",
        action: { label: "Upgrade", url: status.actionUrl },
      };
  }
};

/** One request per organization at a time; the answer is kept briefly. */
const KEEP_MS = 15_000;
const cache = new Map<
  string,
  { at: number; status: Promise<AiStatus | null> }
>();

/** The last answer per organization, so an editor opened again starts right. */
const lastKnown = new Map<string, AiStatus | null>();

const fetchAiStatus = (organizationId: string): Promise<AiStatus | null> => {
  const known = cache.get(organizationId);
  if (known && Date.now() - known.at < KEEP_MS) return known.status;

  const status = fetch(
    `${window.location.origin}/ai/status?organizationId=${encodeURIComponent(organizationId)}`,
    { headers: { ...appData.getProxyConfig().headers } },
  )
    .then((res) => (res.ok ? (res.json() as Promise<AiStatus>) : null))
    // An older server without the route: assume it works, as before.
    .catch(() => null)
    .then((answer) => {
      lastKnown.set(organizationId, answer);
      return answer;
    });
  cache.set(organizationId, { at: Date.now(), status });
  return status;
};

/**
 * The organization's AI status, checked again whenever the window regains
 * focus, so connecting in another tab or coming back online shows up.
 *
 * Undefined only while the first answer for this organization is on its way;
 * after that it starts from the last one, so nothing changes shape on open.
 * Null when the server cannot say.
 */
export const useAiStatus = (
  organizationId: string | undefined,
): AiStatus | null | undefined => {
  const [status, setStatus] = useState<AiStatus | null | undefined>(() =>
    organizationId && lastKnown.has(organizationId)
      ? lastKnown.get(organizationId)
      : organizationId
        ? undefined
        : null,
  );

  useEffect(() => {
    if (!organizationId) return;
    let live = true;
    const check = () =>
      void fetchAiStatus(organizationId).then((next) => {
        if (live) setStatus(next);
      });
    check();
    window.addEventListener("focus", check);
    return () => {
      live = false;
      window.removeEventListener("focus", check);
    };
  }, [organizationId]);

  return status;
};

/**
 * Follows an action in a new tab, never in place: it is chosen from inside an
 * editor, and leaving the page would lose what is in it. In Studio this opens
 * the browser.
 */
export const openAiStatusAction = (url: string) => {
  window.open(new URL(url, window.location.origin), "_blank", "noopener");
};
