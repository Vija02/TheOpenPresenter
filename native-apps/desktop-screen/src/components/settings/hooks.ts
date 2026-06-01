import { invoke } from "@tauri-apps/api/core";
import { type UnlistenFn, listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import type { HostStatus, MonitorInfo } from "./types";

const useTauriLiveState = <T>(
  initialCommand: string,
  eventName: string,
  enabled = true,
): T | null => {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let unlisten: UnlistenFn | null = null;
    (async () => {
      try {
        const v = await invoke<T>(initialCommand);
        if (!cancelled) setValue(v);
      } catch {
        if (!cancelled) setValue(null);
      }
      unlisten = await listen<T>(eventName, (e) => {
        setValue(e.payload);
      });
      if (cancelled && unlisten) unlisten();
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [initialCommand, eventName, enabled]);

  return value;
};

export const useScreenVisibility = (): boolean | null =>
  useTauriLiveState<boolean>("is_screen_visible", "screen-visibility");

export const useScreenMute = (): {
  supported: boolean;
  muted: boolean | null;
} => {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;
    invoke<boolean>("mute_supported")
      .then((ok) => {
        if (!cancelled) setSupported(ok);
      })
      .catch(() => {
        if (!cancelled) setSupported(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const muted = useTauriLiveState<boolean>(
    "is_screen_muted",
    "screen-muted",
    supported,
  );

  return { supported, muted };
};

export const useMonitors = (): MonitorInfo[] | null => {
  const [monitors, setMonitors] = useState<MonitorInfo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | null = null;
    const refresh = async () => {
      try {
        const mons = await invoke<MonitorInfo[]>("list_monitors");
        if (!cancelled) setMonitors(mons);
      } catch {}
    };
    (async () => {
      await refresh();
      unlisten = await listen("monitors-changed", () => {
        refresh();
      });
      if (cancelled && unlisten) unlisten();
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return monitors;
};

/** One-shot host reachability check, re-fires whenever `rootUrl` changes. */
export const useHostReachability = (
  rootUrl: string,
): { status: HostStatus; error: string | null } => {
  const [status, setStatus] = useState<HostStatus>("unknown");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rootUrl) {
      setStatus("down");
      setError("Server URL is not set.");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    setError(null);
    invoke<boolean>("check_host", { url: rootUrl })
      .then((ok) => {
        if (cancelled) return;
        setStatus(ok ? "ok" : "down");
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus("down");
        setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [rootUrl]);

  return { status, error };
};
