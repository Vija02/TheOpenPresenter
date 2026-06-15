import { useEffect, useState } from "react";

import { type UnlistenFn, invoke, listen } from "../../bridge/ipc";
import type { HostStatus, MonitorInfo } from "./types";

const useLiveState = <T>(
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
  useLiveState<boolean>("is_screen_visible", "screen-visibility");

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

  const muted = useLiveState<boolean>(
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
    let unlisten: UnlistenFn | null = null;

    const check = async (showChecking: boolean) => {
      if (showChecking && !cancelled) {
        setStatus("checking");
        setError(null);
      }
      try {
        const ok = await invoke<boolean>("check_host", { url: rootUrl });
        if (!cancelled) setStatus(ok ? "ok" : "down");
      } catch (e) {
        if (!cancelled) {
          setStatus("down");
          setError(String(e));
        }
      }
    };

    check(true);
    const interval = setInterval(() => check(false), 15000);

    (async () => {
      unlisten = await listen<{ status: string; rootUrl?: string }>(
        "host-wait",
        (e) => {
          if (cancelled) return;
          if (e.payload.rootUrl && e.payload.rootUrl !== rootUrl) return;
          if (e.payload.status === "ready") {
            setStatus("ok");
            setError(null);
          } else if (e.payload.status === "waiting") {
            setStatus("checking");
          }
        },
      );
      if (cancelled && unlisten) unlisten();
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
      unlisten?.();
    };
  }, [rootUrl]);

  return { status, error };
};
