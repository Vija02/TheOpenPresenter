import { Button } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";

import { type Account, api } from "../bridge/ipc";

/** Info on the cloud account that is being connected */
export function CloudAccount({
  isCloud,
  onError,
}: {
  isCloud: boolean;
  onError: (message: string | null) => void;
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const refresh = useCallback(() => {
    api
      .account()
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setChecked(true));
  }, []);

  useEffect(refresh, [refresh]);

  // Sign-in finishes in the browser, which cannot tell this window about it.
  // Polling is the only way to notice, and it stops as soon as it works.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      try {
        const found = await api.account();
        if (found) {
          setAccount(found);
          setWaiting(false);
          setBusy(false);
        }
      } catch {
        // Keep waiting: a failed check mid-flow is expected.
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [waiting]);

  const signIn = async () => {
    onError(null);
    setBusy(true);
    try {
      const result = await api.beginAuth();
      if (!result.supported) {
        onError(result.reason);
        setBusy(false);
        return;
      }
      // `auth:begin` already opened the browser, and the session lands in the
      // shared cookie jar whenever the user finishes there. Nothing here can
      // know when that is, so poll rather than claim success.
      setWaiting(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const signOut = async () => {
    onError(null);
    setBusy(true);
    try {
      await api.logout();
      // `host:logout` sends the main window back to onboarding, but this panel
      // is a separate window and stays open. Clearing the account here is what
      // takes the button out of "Signing out…" and back to "Sign in".
      setAccount(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!checked) {
    return (
      <div className="cloud-banner">
        <span className="muted">Checking sign-in…</span>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="cloud-banner">
        <div className="cloud-banner-text">
          <span className="cloud-banner-title">Not signed in</span>
          <span className="muted">
            {waiting
              ? "Finish signing in in your browser."
              : isCloud
                ? "Sign in to reach your projects on the cloud."
                : "Sign in to reach your projects on this instance."}
          </span>
        </div>
        {waiting ? (
          <Button
            variant="link"
            onClick={() => {
              void api.cancelAuth();
              setWaiting(false);
              setBusy(false);
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void signIn()}>
            Sign in
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="cloud-banner cloud-banner-on">
      <div className="cloud-banner-text">
        <span className="cloud-banner-title">
          {isCloud ? "Connected to the cloud" : "Signed in"}
        </span>
        <span className="muted">
          {account.email ?? account.name ?? account.username}
        </span>
      </div>
      <Button variant="link" disabled={busy} onClick={() => void signOut()}>
        {busy ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
