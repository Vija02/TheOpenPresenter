import { Alert, Button } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";

import {
  type CloudConnection,
  type Mode,
  type Settings,
  api,
} from "../bridge/ipc";
import { ChooseOrganization } from "./ChooseOrganization";
import { ChooseSetup, type SetupChoice } from "./ChooseSetup";
import { DownloadStatus } from "./DownloadStatus";
import { LocalRuntime } from "./LocalRuntime";
import { NameOrganization } from "./NameOrganization";
import { SignIn } from "./SignIn";
import { canGoBack, current, pop, push } from "./history";
import { type Step, firstStep } from "./steps";
import { useRuntimeDownload } from "./useRuntimeDownload";

/**
 * First-run setup. One question decides everything after it: is this the
 * machine that runs the server? If so the runtime download starts immediately
 * and sign-in links it to a cloud organisation. If not, the user is only
 * choosing which server to point at.
 */
export function Onboarding() {
  const [history, setHistory] = useState<Step[]>(["role"]);
  const step = current(history);
  const [settings, setSettings] = useState<Settings>({});
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [, setConnection] = useState<CloudConnection | null>(null);
  const download = useRuntimeDownload();

  /** Move forward, remembering where we came from. */
  const goTo = useCallback((next: Step) => {
    setHistory((stack) => push(stack, next));
    setError(null);
  }, []);

  /** Step back. Clears the error so a failure does not follow you. */
  const goBack = useCallback(() => {
    setHistory(pop);
    setError(null);
  }, []);

  /** Jump to a starting step, discarding any history. */
  const resetTo = useCallback((next: Step) => {
    setHistory([next]);
  }, []);

  // Read back from settings so a returning user keeps the choice they made.
  const runsLocally = settings.autoStartRuntime ?? false;

  useEffect(() => {
    api
      .getSettings()
      .then((loaded) => {
        setSettings(loaded);
        resetTo(firstStep(loaded));
      })
      .catch((err) => {
        setError(String(err));
        resetTo("role");
      });
  }, [resetTo]);

  /**
   * Start the local server and hand the window over to it. The end of every
   * path that runs locally.
   */
  const finishLocally = useCallback(async () => {
    setError(null);
    setFinishing(true);
    try {
      await download.wait();
      await api.runtimeStart();
    } catch (err) {
      setError(String(err));
      setFinishing(false);
    }
  }, [download]);

  /**
   * Finish setup once the user has signed in. Signing in and running locally
   * are not alternatives: on a complete setup the machine still serves, and
   * the account exists so the local server can be linked to a cloud
   * organisation. So sign-in lands on the local server, not the cloud one.
   */
  const onConnect = useCallback(
    async (chosen: Mode, rootUrl: string) => {
      setError(null);

      if (!runsLocally) {
        try {
          await api.connect(chosen, rootUrl);
        } catch (err) {
          setError(String(err));
        }
        return;
      }

      setFinishing(true);
      try {
        // Connecting before the runtime exists would drop the user on a cloud
        // page with no way back to the local server they chose.
        await download.wait();
        // No rootUrl: passing the cloud address would store it as the local
        // server, when the runtime is what reports the real one.
        await api.runtimeStart({ open: false });

        // Done now, with the session just established, rather than left as
        // something to discover later.
        setConnection(await api.cloudConnect(rootUrl || undefined));
        setFinishing(false);
        goTo("organization");
      } catch (err) {
        setError(String(err));
        setFinishing(false);
      }
    },
    [download, runsLocally],
  );

  const chooseSetup = (choice: SetupChoice) => {
    const complete = choice.kind === "complete";
    // First because it is the long pole and sign-in does not need it. Failure
    // is recorded in the hook and shown by DownloadStatus, so the rejection is
    // absorbed here; `wait` re-raises it for whoever needs it.
    if (complete) download.start(choice.channel).catch(() => undefined);
    // Saved either way, so a later switch to running locally uses the same
    // choice rather than silently reverting.
    const patch = { autoStartRuntime: complete, channel: choice.channel };
    // Mirrored into local state as well as persisted: `runsLocally` is read
    // when sign-in completes, and a stale `false` there sent a complete setup
    // to the cloud URL instead of its own server.
    setSettings((prev) => ({ ...prev, ...patch }));
    void api.updateSettings(patch);
    goTo("signin");
  };

  return (
    <div className="shell">
      {step === "local" && (
        <header className="shell-header">
          <h1>TheOpenPresenter</h1>
          <Button variant="link" onClick={() => goTo("signin")}>
            Sign in instead
          </Button>
        </header>
      )}

      {canGoBack(history) && !finishing && (
        <Button variant="link" className="back" onClick={goBack}>
          ← Back
        </Button>
      )}

      {error && (
        <Alert variant="destructive" size="sm">
          {error}
        </Alert>
      )}

      {step === "role" && (
        <ChooseSetup
          busy={false}
          onContinue={chooseSetup}
          initialKind={
            settings.autoStartRuntime === false ? "minimal" : undefined
          }
          initialChannel={settings.channel}
        />
      )}

      {step === "signin" && (
        <SignIn
          onConnect={onConnect}
          busy={finishing}
          busyLabel={
            download.active ? "Finishing the download…" : "Starting the server…"
          }
          initialUrl={
            settings.mode === "selfhosted" ? settings.rootUrl : undefined
          }
          footer={
            /* Only on a complete setup: minimal downloads nothing, so there
               is no progress to report and "Ready to run on this computer"
               would be untrue. */
            runsLocally ? <DownloadStatus state={download} /> : null
          }
          secondary={
            /* Skip rather than "run locally instead": signing in is not an
               alternative to running the server, it is what links the server
               to a cloud organisation. Skipping leaves that unlinked.

               On a minimal setup there is no runtime to fall back to, so
               skipping would strand the user on a server-management screen
               for a server this machine never runs. Sign-in is the only way
               forward there. */
            !finishing && runsLocally ? (
              <Button
                variant="link"
                size="xs"
                onClick={() => void finishLocally()}
              >
                Skip for now
              </Button>
            ) : null
          }
        />
      )}

      {step === "organization" && (
        <ChooseOrganization
          onConnected={() => void finishLocally()}
          onSkip={() => goTo("name")}
          onError={setError}
        />
      )}

      {step === "name" && (
        <NameOrganization
          onCreated={() => void finishLocally()}
          onError={setError}
        />
      )}

      {step === "local" && <LocalRuntime onError={setError} />}
    </div>
  );
}
