import { displayName } from "../displayName";
import {
  FULLSCREEN_MESSAGE,
  PRESENT_WINDOW_PREFIX,
  newWindowId,
} from "./presentChannel";
import type { Monitor } from "../types";

/** Capability delegation: Chromium only, and not feature-detectable */
export const supportsFullscreenHandoff = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands: { brand: string }[] };
    }
  ).userAgentData?.brands;
  if (brands) return brands.some((b) => b.brand === "Chromium");
  // iOS browsers are Safari underneath
  return /Chrome\//.test(navigator.userAgent);
};

// https://developer.mozilla.org/docs/Web/API/Window_Management_API

type ScreenDetailed = Screen & {
  availLeft: number;
  availTop: number;
  left: number;
  top: number;
  isPrimary: boolean;
  isInternal: boolean;
  label: string;
};

type ScreenDetails = EventTarget & {
  screens: ScreenDetailed[];
  currentScreen: ScreenDetailed;
};

type WindowWithScreenDetails = Window & {
  getScreenDetails?: () => Promise<ScreenDetails>;
};

const CLOSED_POLL_MS = 1000;
const PLAIN_WINDOW = { width: 1280, height: 720 };

export const supportsWindowManagement = (): boolean =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  typeof (window as WindowWithScreenDetails).getScreenDetails === "function";

let details: Promise<ScreenDetails> | null = null;
/** So a click can open a window without awaiting anything */
let knownDetails: ScreenDetails | null = null;

const getDetails = (): Promise<ScreenDetails> => {
  if (!details) {
    details = (window as WindowWithScreenDetails).getScreenDetails!()
      .then((d) => {
        knownDetails = d;
        return d;
      })
      .catch((error) => {
        details = null;
        throw error;
      });
  }
  return details;
};

const screenKey = (screen: ScreenDetailed) =>
  `${screen.label}@${screen.left},${screen.top}`;

export type WindowManagementPermission =
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported";

export async function windowManagementPermission(): Promise<WindowManagementPermission> {
  if (!supportsWindowManagement()) return "unsupported";
  try {
    const status = await navigator.permissions.query({
      name: "window-management" as PermissionName,
    });
    return status.state;
  } catch {
    return "prompt";
  }
}

export async function listWebMonitors(): Promise<Monitor[]> {
  const { screens, currentScreen } = await getDetails();
  return screens.map((screen, index) => ({
    index,
    id: screenKey(screen),
    name: displayName(screen.label, index, screen.isInternal),
    width: screen.width,
    height: screen.height,
    x: screen.left,
    y: screen.top,
    isPrimary: screen.isPrimary,
    isCurrent: screenKey(screen) === screenKey(currentScreen),
  }));
}

/** Names can repeat, positions can't */
export const displayKey = (display: { x: number; y: number }) =>
  `${display.x},${display.y}`;

const screenName = (screen: ScreenDetailed, screens: ScreenDetailed[]) =>
  displayName(
    screen.label,
    screens.findIndex((s) => screenKey(s) === screenKey(screen)),
    screen.isInternal,
  );

/** The display this window is on. Never prompts: null until permitted. */
export function watchCurrentScreen(
  onChange: (screen: { name: string; key: string } | null) => void,
): () => void {
  if (!supportsWindowManagement()) {
    onChange(null);
    return () => {};
  }

  let cancelled = false;
  let target: ScreenDetails | null = null;
  let permission: PermissionStatus | null = null;
  const report = () => {
    if (target && !cancelled) {
      const current = target.currentScreen;
      onChange({
        name: screenName(current, target.screens),
        key: displayKey({ x: current.left, y: current.top }),
      });
    }
  };

  const start = async () => {
    if ((await windowManagementPermission()) !== "granted" || cancelled) {
      onChange(null);
      return;
    }
    if (target) return;
    try {
      target = await getDetails();
    } catch {
      return;
    }
    if (cancelled) return;
    target.addEventListener("currentscreenchange", report);
    target.addEventListener("screenschange", report);
    report();
  };

  void start();
  void navigator.permissions
    .query({ name: "window-management" as PermissionName })
    .then((status) => {
      if (cancelled) return;
      permission = status;
      permission.addEventListener("change", start);
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    target?.removeEventListener("currentscreenchange", report);
    target?.removeEventListener("screenschange", report);
    permission?.removeEventListener("change", start);
  };
}

export function onWebMonitorsChanged(handler: () => void): () => void {
  let target: ScreenDetails | null = null;
  let permission: PermissionStatus | null = null;
  let cancelled = false;

  const start = () => {
    void windowManagementPermission().then((state) => {
      if (state !== "granted" || cancelled || target) return;
      void getDetails()
        .then((d) => {
          if (cancelled || target) return;
          target = d;
          target.addEventListener("screenschange", handler);
          target.addEventListener("currentscreenchange", handler);
          handler();
        })
        .catch(() => {});
    });
  };

  start();
  if (supportsWindowManagement()) {
    void navigator.permissions
      .query({ name: "window-management" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        permission = status;
        permission.addEventListener("change", start);
      })
      .catch(() => {});
  }

  return () => {
    cancelled = true;
    target?.removeEventListener("screenschange", handler);
    target?.removeEventListener("currentscreenchange", handler);
    permission?.removeEventListener("change", start);
  };
}

/** By window name, which the window also uses as its id */
const popups = new Map<string, { rendererId: string; window: Window }>();
const presentingListeners = new Set<(rendererIds: string[]) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

export const listWebPresenting = (): string[] => [
  ...new Set(
    [...popups.values()]
      .filter((p) => !p.window.closed)
      .map((p) => p.rendererId),
  ),
];

const latestPopup = (rendererId: string): [string, Window] | null => {
  let latest: [string, Window] | null = null;
  for (const [name, p] of popups) {
    if (p.rendererId === rendererId && !p.window.closed) {
      latest = [name, p.window];
    }
  }
  return latest;
};

export const latestWebWindowId = (rendererId: string): string | null =>
  latestPopup(rendererId)?.[0] ?? null;

const notifyPresenting = () => {
  const ids = listWebPresenting();
  presentingListeners.forEach((listener) => listener(ids));
};

// We aren't told when a window closes itself
const watchPopups = () => {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    let changed = false;
    for (const [name, p] of popups) {
      if (p.window.closed) {
        popups.delete(name);
        changed = true;
      }
    }
    if (changed) notifyPresenting();
    if (popups.size === 0 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }, CLOSED_POLL_MS);
};

export function onWebPresentingChanged(
  handler: (rendererIds: string[]) => void,
): () => void {
  presentingListeners.add(handler);
  return () => presentingListeners.delete(handler);
}

const openPopup = (url: string, rendererId: string, features: string[]) => {
  const name = `${PRESENT_WINDOW_PREFIX}${newWindowId()}`;
  const popup = window.open(url, name, ["popup", ...features].join(","));
  if (!popup) throw new Error("Popup blocked");

  popups.set(name, { rendererId, window: popup });
  watchPopups();
  notifyPresenting();
};

/** Must run from a click */
export async function presentOnWebMonitor(
  url: string,
  rendererId: string,
  monitorId?: string,
  monitorIndex = 0,
): Promise<void> {
  // Awaiting could outlast the click and get the popup blocked
  const { screens } = knownDetails ?? (await getDetails());
  const screen =
    screens.find((s) => screenKey(s) === monitorId) ?? screens[monitorIndex];
  if (!screen) throw new Error("Display not found");

  openPopup(url, rendererId, [
    "fullscreen",
    `left=${screen.availLeft}`,
    `top=${screen.availTop}`,
    `width=${screen.availWidth}`,
    `height=${screen.availHeight}`,
  ]);
}

/** Must run from a click */
export function openWebWindow(url: string, rendererId: string): void {
  const width = Math.min(PLAIN_WINDOW.width, window.screen.availWidth);
  const height = Math.min(PLAIN_WINDOW.height, window.screen.availHeight);
  openPopup(url, rendererId, [`width=${width}`, `height=${height}`]);
}

/** Must run from a click, which is handed to the window */
export function requestWebFullscreen(
  rendererId: string,
  windowId?: string,
): boolean {
  const popup = windowId
    ? popups.get(windowId)?.window
    : latestPopup(rendererId)?.[1];
  if (!popup || popup.closed || !supportsFullscreenHandoff()) return false;
  try {
    popup.postMessage(
      { type: FULLSCREEN_MESSAGE },
      // `delegate` isn't in the DOM typings yet
      {
        targetOrigin: window.location.origin,
        delegate: "fullscreen",
      } as WindowPostMessageOptions,
    );
    return true;
  } catch {
    popup.postMessage({ type: FULLSCREEN_MESSAGE }, window.location.origin);
    return true;
  }
}

export const hasWebWindow = (
  rendererId: string,
  windowId?: string,
): boolean => {
  if (!windowId) return latestPopup(rendererId) !== null;
  const popup = popups.get(windowId);
  return !!popup && !popup.window.closed;
};

export function stopWebPresenting(rendererId: string): boolean {
  let closed = false;
  for (const [name, p] of popups) {
    if (p.rendererId !== rendererId) continue;
    p.window.close();
    popups.delete(name);
    closed = true;
  }
  if (closed) notifyPresenting();
  return closed;
}
