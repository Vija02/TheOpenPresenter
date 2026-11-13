import {
  type PresentWindowInfo,
  desktop,
  watchPresentWindows,
} from "@repo/desktop-bridge";
import { usePluginMetaData } from "@repo/shared";
import { useCallback, useSyncExternalStore } from "react";

import { usePresentingRenderers } from "./usePresentingRenderers";

/** One watcher per project, stopped when the last listener goes */
type Watcher = {
  windows: PresentWindowInfo[];
  listeners: Set<() => void>;
  close: (target?: { outputId?: string; id?: string }) => void;
  stop: () => void;
};

const watchers = new Map<string, Watcher>();
const EMPTY: PresentWindowInfo[] = [];

const startWatcher = (orgSlug: string, projectSlug: string): Watcher => {
  const key = `${orgSlug}/${projectSlug}`;
  const existing = watchers.get(key);
  if (existing) return existing;

  const watcher: Watcher = {
    windows: EMPTY,
    listeners: new Set(),
    close: () => {},
    stop: () => {},
  };
  watchers.set(key, watcher);
  const { close, stop } = watchPresentWindows(
    { orgSlug, projectSlug },
    (windows) => {
      watcher.windows = windows;
      watcher.listeners.forEach((listener) => listener());
    },
  );
  watcher.close = close;
  watcher.stop = () => {
    stop();
    watchers.delete(key);
  };
  return watcher;
};

const usePresentWindows = () => {
  const { orgSlug, projectSlug } = usePluginMetaData();
  // Studio tracks its own windows
  const enabled = !desktop.isDesktop;
  const key = `${orgSlug}/${projectSlug}`;

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!enabled) return () => {};
      const watcher = startWatcher(orgSlug, projectSlug);
      watcher.listeners.add(listener);
      listener();
      return () => {
        watcher.listeners.delete(listener);
        if (watcher.listeners.size === 0) watcher.stop();
      };
    },
    [enabled, orgSlug, projectSlug],
  );

  const windows = useSyncExternalStore(
    subscribe,
    () => watchers.get(key)?.windows ?? EMPTY,
  );

  const closeWindows = useCallback(
    (target?: { outputId?: string; id?: string }) => {
      watchers.get(key)?.close(target);
    },
    [key],
  );

  return { windows, closeWindows };
};

export type OutputLiveStatus = {
  isLive: boolean;
  windows: PresentWindowInfo[];
  isFullscreen: boolean;
  canStop: boolean;
};

export const usePresentStatus = () => {
  const { data: presenting, refetch } = usePresentingRenderers();
  const { windows, closeWindows } = usePresentWindows();

  const statusOf = useCallback(
    (outputId: string): OutputLiveStatus => {
      const own = windows.filter((w) => w.outputId === outputId);
      const onDisplay = (presenting ?? []).includes(outputId);
      return {
        isLive: own.length > 0 || onDisplay,
        windows: own,
        isFullscreen: own.length > 0 && own.every((w) => w.fullscreen),
        canStop: onDisplay || own.some((w) => w.canClose),
      };
    },
    [presenting, windows],
  );

  const stoppableOutputIds = [
    ...new Set([
      ...(presenting ?? []),
      ...windows.filter((w) => w.canClose).map((w) => w.outputId),
    ]),
  ];

  const stop = useCallback(
    async (outputId: string) => {
      await desktop.stopPresenting(outputId);
      closeWindows({ outputId });
      await refetch();
    },
    [closeWindows, refetch],
  );

  const stopAll = useCallback(async () => {
    await Promise.all(
      (presenting ?? []).map((outputId) => desktop.stopPresenting(outputId)),
    );
    closeWindows();
    await refetch();
  }, [closeWindows, presenting, refetch]);

  const closeWindow = useCallback(
    (id: string) => closeWindows({ id }),
    [closeWindows],
  );

  return {
    statusOf,
    stoppableOutputIds,
    stop,
    stopAll,
    closeWindow,
    displayOutputIds: desktop.isDesktop ? (presenting ?? []) : [],
  };
};
