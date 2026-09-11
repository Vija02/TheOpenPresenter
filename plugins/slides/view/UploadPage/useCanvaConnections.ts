import { useCallback, useEffect, useState } from "react";

export type CanvaConnection = { id: string; displayName: string | null };

export const useCanvaConnections = (token: string) => {
  const [connections, setConnections] = useState<CanvaConnection[] | null>(
    null,
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/plugin/slides/canva-connection/${token}`);
    if (!res.ok) return [] as CanvaConnection[];
    const body = await res.json();
    const linked: CanvaConnection[] = body.connections ?? [];
    setConnections(linked);
    return linked;
  }, [token]);

  const startConnect = useCallback(() => {
    setIsConnecting(true);
    setConnections(null);

    window.open(
      `/plugin/slides/canva/authorize-public?token=${token}`,
      "canva-connect",
      "width=600,height=800",
    );
  }, [token]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "top-canva-oauth") return;

      setIsConnecting(false);
      if (event.data.ok) void reload();
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [reload]);

  // Poll while a connect is in flight so the designs still appear in case post message didn't arrive
  useEffect(() => {
    if (!isConnecting) return;

    let cancelled = false;
    const startedAt = Date.now();
    const TIMEOUT_MS = 3 * 60 * 1000;

    const timer = setInterval(() => {
      if (cancelled) return;

      if (Date.now() - startedAt > TIMEOUT_MS) {
        setIsConnecting(false);
        return;
      }

      void reload().then((linked) => {
        if (!cancelled && linked.length > 0) setIsConnecting(false);
      });
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isConnecting, reload]);

  return { connections, isConnecting, startConnect, reload };
};
