import { Alert, Button, Input } from "@repo/ui";
import { useEffect, useState } from "react";

import { type Mode, api, listen } from "../bridge/ipc";
import { Logo } from "../shared/Logo";

const CLOUD_URL = "https://theopenpresenter.com";

/**
 * Sign in, with the cloud as the default. "Use my own server" is a quiet link
 * rather than a fork in the road, and choosing it reveals an address field and
 * then follows the same path, because a self-hosted server serves the same
 * handoff.
 *
 * Sign-in itself happens in the real browser, where password managers,
 * passkeys and existing Google sessions already are.
 */
export function SignIn({
  onConnect,
  initialUrl,
  footer,
  secondary,
  busy: externallyBusy = false,
  busyLabel,
}: {
  onConnect: (mode: Mode, rootUrl: string) => Promise<void>;
  initialUrl?: string;
  footer?: React.ReactNode;
  /** Sits beside "use my own server", for actions that leave this step. */
  secondary?: React.ReactNode;
  /** Set while the caller finishes setup after a successful sign-in. */
  busy?: boolean;
  busyLabel?: string;
}) {
  const [custom, setCustom] = useState(Boolean(initialUrl));
  const [input, setInput] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [headline, setHeadline] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const mode: Mode = custom ? "selfhosted" : "cloud";

  // The session is established in the main process, so completion arrives as
  // an event rather than as the resolution of the call that started it.
  useEffect(() => {
    const offDone = listen<{ rootUrl: string }>("auth:completed", (payload) => {
      void onConnect(mode, payload.rootUrl);
    });
    const offFail = listen<{ message: string }>("auth:failed", (payload) => {
      setProblem(payload.message);
      setHeadline("Sign-in did not finish");
      setWaiting(false);
      setAuthUrl(null);
    });
    return () => {
      offDone();
      offFail();
    };
  }, [mode, onConnect]);

  const start = async ({ register = false } = {}) => {
    setProblem(null);
    setHeadline(null);
    setBusy(true);
    try {
      const target = custom ? await api.normalizeHost(input) : CLOUD_URL;
      if (!target) {
        setProblem("Enter a server address.");
        setHeadline("No server address");
        return;
      }

      const reachable = await api.checkHost(target);
      if (!reachable) {
        setProblem(`Could not reach ${target}.`);
        setHeadline("Could not reach that server");
        return;
      }

      const result = await api.beginAuth(target, undefined, { register });
      if (!result.supported) {
        // An older server without the handoff: connect anyway and let the page
        // ask for a password itself.
        await onConnect(mode, target);
        return;
      }

      setAuthUrl(result.authUrl);
      setRegistering(register);
      setWaiting(true);
      // `auth:begin` already opened the browser. Opening it here too produced
      // two tabs, and the second consumed the same one-shot token, so it
      // reported success and then failure.
    } catch (err) {
      setProblem(String(err));
      setHeadline("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // Signed in while the caller waits for the download and the server. Shown
  // instead of the form so nobody signs in twice.
  if (externallyBusy) {
    return (
      <div className="onboarding">
        <div className="hero">
          <Logo />
          <h2>Almost ready</h2>
        </div>
        <p className="muted">{busyLabel ?? "Finishing setup…"}</p>
        {footer}
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="onboarding">
        <h2>
          {registering ? "Finish creating your account" : "Finish signing in"}
        </h2>
        <p className="muted">
          {registering
            ? "Your browser is open. Create your account there and this window will continue on its own."
            : "Your browser is open. Sign in there and this window will continue on its own."}
        </p>
        {authUrl && (
          <Button variant="link" onClick={() => api.openExternal(authUrl)}>
            Open the browser again
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            void api.cancelAuth();
            setWaiting(false);
            setAuthUrl(null);
          }}
        >
          Cancel
        </Button>
        {footer}
      </div>
    );
  }

  return (
    <div className="onboarding">
      <div className="hero">
        <Logo />
        <h2>Connect to your account</h2>
      </div>
      {custom && (
        <label className="field">
          <span>Server address</span>
          <Input
            autoFocus
            value={input}
            placeholder="presenter.mychurch.org"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void start()}
          />
        </label>
      )}

      <Button
        className="onboarding-primary"
        disabled={busy}
        onClick={() => void start()}
      >
        {busy
          ? "Connecting…"
          : custom
            ? "Connect"
            : "Sign in to TheOpenPresenter Cloud"}
      </Button>

      {/* Below the button: the failure is a response to pressing it, so it
          reads in the order it happened. */}
      {problem && (
        <Alert
          variant="destructive"
          size="sm"
          title={headline ?? "Could not connect"}
        >
          {problem}
        </Alert>
      )}

      {/* Only for the cloud: a self-hosted server has its own accounts, and
          registering on ours would not grant access to it. */}
      {!custom && (
        <p className="muted small">
          Don&apos;t have an account?{" "}
          <Button
            variant="link"
            disabled={busy}
            onClick={() => void start({ register: true })}
          >
            Register
          </Button>
        </p>
      )}

      {/* Separated and quieter than the register link above: these are ways
          out of the suggested path, not alternatives being offered. One row,
          because stacking them made the skip read as a third step. */}
      <div className="link-row link-row-alt">
        <Button
          variant="link"
          size="xs"
          onClick={() => {
            setCustom(!custom);
            setProblem(null);
            setHeadline(null);
          }}
        >
          {custom ? "Use TheOpenPresenter cloud" : "Use my own server"}
        </Button>
        {secondary}
      </div>

      {footer}
    </div>
  );
}
