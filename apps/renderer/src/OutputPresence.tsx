import type { OutputPresence, PresentCommand } from "@repo/base-plugin";
import {
  FULLSCREEN_MESSAGE,
  announcePresentWindow,
  browserName,
  canCloseSelf,
  desktop,
  getDeviceId,
  isOpenedByRemote,
  isOwnWindow,
  newWindowId,
  watchCurrentScreen,
} from "@repo/desktop-bridge";
import {
  useAwareness,
  useOutputPresence,
  usePluginData,
  usePluginMetaData,
} from "@repo/shared";
import { useEffect, useMemo, useRef, useState } from "react";

const goFullscreen = () =>
  document.documentElement.requestFullscreen?.().catch(() => {});

const useIsFullscreen = () => {
  const [fullscreen, setFullscreen] = useState(
    () => !!document.fullscreenElement,
  );
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  return fullscreen;
};

const useCurrentScreen = () => {
  const [screen, setScreen] = useState<{ name: string; key: string } | null>(
    null,
  );
  useEffect(() => watchCurrentScreen(setScreen), []);
  return screen;
};

const useReportPresence = (presence: OutputPresence) => {
  const setPresence = useOutputPresence((x) => x.setPresence);
  const json = JSON.stringify(presence);
  useEffect(() => {
    setPresence(JSON.parse(json));
  }, [json, setPresence]);
  useEffect(() => () => setPresence(null), [setPresence]);
};

const useCloseWhenAsked = (windowId: string, rendererId: string) => {
  const { awarenessData } = useAwareness();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    for (const state of awarenessData) {
      const command = (state as { presentCommand?: PresentCommand })
        .presentCommand;
      if (!command?.close.includes(windowId)) continue;
      const key = `${command.at}`;
      if (handled.current.has(key)) continue;
      handled.current.add(key);

      if (desktop.isDesktop) void desktop.stopPresenting(rendererId);
      else window.close();
    }
  }, [awarenessData, windowId, rendererId]);
};

/** Reports where this output is showing, and handles close/fullscreen requests */
export const OutputPresenceReporter = ({
  outputId,
  virtualScreen = null,
}: {
  outputId: string;
  virtualScreen?: { id: string; name: string } | null;
}) => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  const { rendererId } = usePluginData();

  // The opener knows it by its name
  const windowId = useMemo(
    () => (isOpenedByRemote() ? window.name : newWindowId()),
    [],
  );
  const ownWindow = useMemo(() => isOwnWindow(), []);
  const fullscreen = useIsFullscreen();
  const screen = useCurrentScreen();

  const where: OutputPresence["where"] = virtualScreen
    ? "virtual"
    : !ownWindow
      ? "here"
      : desktop.isDesktop
        ? "studio"
        : isOpenedByRemote()
          ? "window"
          : "tab";

  useReportPresence({
    windowId,
    deviceId: getDeviceId(),
    outputId,
    where,
    // Studio windows fill their display
    fullscreen: fullscreen || where === "studio" || where === "here",
    screenName: screen?.name ?? null,
    screenKey: screen?.key ?? null,
    virtualScreenId: virtualScreen?.id ?? null,
    virtualScreenName: virtualScreen?.name ?? null,
    browser: browserName(),
    canClose:
      where === "studio" ||
      ((where === "window" || where === "tab") && canCloseSelf()),
  });
  useCloseWhenAsked(windowId, rendererId);

  const isBrowserWindow = where === "window" || where === "tab";

  useEffect(() => {
    if (!isBrowserWindow) return;
    return announcePresentWindow({
      orgSlug,
      projectSlug,
      outputId,
      id: windowId,
    });
  }, [isBrowserWindow, orgSlug, projectSlug, outputId, windowId]);

  useEffect(() => {
    if (!isBrowserWindow) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === FULLSCREEN_MESSAGE) void goFullscreen();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isBrowserWindow]);

  // Not for a link opened by hand
  useEffect(() => {
    if (where === "window" && !document.fullscreenElement) void goFullscreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
