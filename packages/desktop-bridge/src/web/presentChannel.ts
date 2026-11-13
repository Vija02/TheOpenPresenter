/** Browser remotes and presentation windows on the same site talk over a BroadcastChannel */

export const PRESENT_WINDOW_PREFIX = "top-renderer-";

export const FULLSCREEN_MESSAGE = "top-present:fullscreen";

export type PresentWindowInfo = {
  id: string;
  outputId: string;
  fullscreen: boolean;
  browser: string;
  kind: "window" | "tab";
  canClose: boolean;
};

type ChannelMessage =
  | ({ type: "window" } & PresentWindowInfo)
  | { type: "window-closed"; id: string }
  | { type: "ping" }
  /** Every window, the windows of one output, or one window */
  | { type: "close"; outputId?: string; id?: string };

/** Not in an iframe, eg. the remote's "This screen" */
export const isOwnWindow = () => {
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
};

export const isOpenedByRemote = () =>
  window.name.startsWith(PRESENT_WINDOW_PREFIX);

/** When window.close() is allowed */
export const canCloseSelf = () =>
  isOpenedByRemote() || !!window.opener || history.length === 1;

const HEARTBEAT_MS = 4000;
const STALE_MS = HEARTBEAT_MS * 3;

const channelName = (orgSlug: string, projectSlug: string) =>
  `top-present:${orgSlug}/${projectSlug}`;

const openChannel = (orgSlug: string, projectSlug: string) =>
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(channelName(orgSlug, projectSlug));

export const browserName = () => {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser";
};

export const newWindowId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** In a presentation window: announce it, and close when asked */
export function announcePresentWindow({
  orgSlug,
  projectSlug,
  outputId,
  id,
}: {
  orgSlug: string;
  projectSlug: string;
  outputId: string;
  id: string;
}): () => void {
  const channel = openChannel(orgSlug, projectSlug);
  if (!channel) return () => {};

  const openedByRemote = isOpenedByRemote();
  const browser = browserName();
  const announce = () =>
    channel.postMessage({
      type: "window",
      id,
      outputId,
      fullscreen: !!document.fullscreenElement,
      browser,
      kind: openedByRemote ? "window" : "tab",
      canClose: canCloseSelf(),
    } satisfies ChannelMessage);

  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    const message = event.data;
    if (message.type === "ping") announce();
    if (
      message.type === "close" &&
      (!message.outputId || message.outputId === outputId) &&
      (!message.id || message.id === id)
    ) {
      window.close();
    }
  };

  const goodbye = () =>
    channel.postMessage({ type: "window-closed", id } satisfies ChannelMessage);

  announce();
  const timer = setInterval(announce, HEARTBEAT_MS);
  document.addEventListener("fullscreenchange", announce);
  window.addEventListener("pagehide", goodbye);

  return () => {
    clearInterval(timer);
    document.removeEventListener("fullscreenchange", announce);
    window.removeEventListener("pagehide", goodbye);
    goodbye();
    channel.close();
  };
}

/** In a remote */
export function watchPresentWindows(
  { orgSlug, projectSlug }: { orgSlug: string; projectSlug: string },
  onChange: (windows: PresentWindowInfo[]) => void,
): {
  close: (target?: { outputId?: string; id?: string }) => void;
  stop: () => void;
} {
  const channel = openChannel(orgSlug, projectSlug);
  if (!channel) return { close: () => {}, stop: () => {} };

  const windows = new Map<string, PresentWindowInfo & { seen: number }>();
  let last = "";

  const emit = () => {
    const list = [...windows.values()]
      .map(({ seen: _seen, ...info }) => info)
      .sort((a, b) => a.id.localeCompare(b.id));
    const snapshot = JSON.stringify(list);
    if (snapshot === last) return;
    last = snapshot;
    onChange(list);
  };

  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    const message = event.data;
    if (message.type === "window") {
      const { type: _type, ...info } = message;
      windows.set(info.id, { ...info, seen: Date.now() });
      emit();
    }
    if (message.type === "window-closed") {
      windows.delete(message.id);
      emit();
    }
  };

  const prune = setInterval(() => {
    const now = Date.now();
    for (const [id, info] of windows) {
      if (now - info.seen > STALE_MS) windows.delete(id);
    }
    emit();
  }, HEARTBEAT_MS);

  channel.postMessage({ type: "ping" } satisfies ChannelMessage);
  onChange([]);

  return {
    close: (target) =>
      channel.postMessage({
        type: "close",
        ...target,
      } satisfies ChannelMessage),
    stop: () => {
      clearInterval(prune);
      channel.close();
    },
  };
}
