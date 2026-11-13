import type {
  AwarenessUserData,
  OutputPresence,
  PresentCommand,
} from "@repo/base-plugin";
import { getDeviceId } from "@repo/desktop-bridge";
import { useAwareness, usePluginData } from "@repo/shared";
import { useCallback, useMemo } from "react";

const COMMAND_TTL_MS = 5000;

let clearTimer: ReturnType<typeof setTimeout> | null = null;
/** So a second request doesn't drop the first */
let pendingClose: string[] = [];

/** Eg. "Mac", "iPad", "Fire TV" */
const machineName = (
  ua: AwarenessUserData["userAgentInfo"] | undefined,
): string | null => {
  if (!ua) return null;
  const { model, vendor, type } = ua.device ?? {};
  if (model === "iPhone" || model === "iPad") return model;
  // TV model names are codes, eg. "MM"
  if (type === "smarttv") {
    if (vendor === "Amazon") return "Fire TV";
    return vendor ? `${vendor} TV` : "Smart TV";
  }
  const os = ua.os?.name;
  if (!os) return null;
  if (/mac/i.test(os)) return "Mac";
  if (ua.device?.type === "mobile") return `${os} phone`;
  if (ua.device?.type === "tablet") return `${os} tablet`;
  return os;
};

export type PresenceWithMachine = OutputPresence & {
  machine: string | null;
  isLocal: boolean;
};

/** Every renderer showing this project, from awareness */
export const useOutputPresences = () => {
  const { awarenessData } = useAwareness();
  const { provider } = usePluginData();

  const presences = useMemo(() => {
    const byId = new Map<string, PresenceWithMachine>();
    for (const state of awarenessData) {
      const presence = state.user?.presence;
      if (
        state.user?.type === "renderer" &&
        !state.user.isPreview &&
        presence
      ) {
        byId.set(presence.windowId, {
          ...presence,
          machine: machineName(state.user.userAgentInfo),
          isLocal: presence.deviceId === getDeviceId(),
        });
      }
    }
    return [...byId.values()];
  }, [awarenessData]);

  const close = useCallback(
    (windowIds: string[]) => {
      if (!provider) return;
      pendingClose = [...new Set([...pendingClose, ...windowIds])];
      provider.setAwarenessField("presentCommand", {
        close: pendingClose,
        at: Date.now(),
      } satisfies PresentCommand);
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        pendingClose = [];
        provider.setAwarenessField("presentCommand", null);
      }, COMMAND_TTL_MS);
    },
    [provider],
  );

  return { presences, close };
};
