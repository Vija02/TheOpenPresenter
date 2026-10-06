import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export const useCanvaSignIn = (token: string) => {
  const [pendingGrantId, setPendingGrantId] = useState<string | null>(null);
  const [grantId, setGrantId] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSignIn = useCallback(() => {
    const id = uuidv4();
    setGrantId(null);
    setError(null);
    setPendingGrantId(id);
    setIsSigningIn(true);

    window.open(
      `/plugin/slides/canva/authorize-public?token=${encodeURIComponent(
        token,
      )}&grant=${id}`,
      "canva-connect",
      "width=600,height=800",
    );
  }, [token]);

  const isReady = useCallback(
    async (id: string) => {
      const res = await fetch(
        `/plugin/slides/canva-sign-in/${token}?grantId=${id}`,
      );
      if (!res.ok) return false;
      return !!(await res.json()).isSignedIn;
    },
    [token],
  );

  useEffect(() => {
    if (!pendingGrantId) return;

    const finish = () => {
      setGrantId(pendingGrantId);
      setPendingGrantId(null);
      setIsSigningIn(false);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "top-canva-oauth") return;
      if (event.data.ok) {
        finish();
      } else {
        setPendingGrantId(null);
        setIsSigningIn(false);
        setError(event.data.error ?? "Canva sign-in failed.");
      }
    };
    window.addEventListener("message", onMessage);

    // Poll in case the popup's message never arrives
    let cancelled = false;
    const startedAt = Date.now();
    const TIMEOUT_MS = 3 * 60 * 1000;
    const timer = setInterval(() => {
      if (Date.now() - startedAt > TIMEOUT_MS) {
        setPendingGrantId(null);
        setIsSigningIn(false);
        return;
      }
      void isReady(pendingGrantId).then((ready) => {
        if (ready && !cancelled) finish();
      });
    }, 1500);

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [pendingGrantId, isReady]);

  return { grantId, isSigningIn, error, startSignIn };
};
