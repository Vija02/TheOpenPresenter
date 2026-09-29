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
import { type Step, firstStep } from "./steps";
import { useRuntimeDownload } from "./useRuntimeDownload";

/**
 * First-run setup. One question decides everything after it: is this the
 * machine that runs the server? If so the runtime download starts immediately
 * and sign-in links it to a cloud organisation. If not, the user is only
 * choosing which server to point at.
 */
export function Onboarding() {
  const [step, setStep] = useState<Step>("role");
  const [settings, setSettings] = useState<Settings>({});
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [, setConnection] = useState<CloudConnection | null>(null);
  const download = useRuntimeDownload();

  // Read back from settings so a returning user keeps the choice they made.
  const runsLocally = settings.autoStartRuntime ?? false;

  useEffect(() => {
    api
      .getSettings()
      .then((loaded) => {
        setSettings(loaded);
        setStep(firstStep(loaded));
      })
      .catch((err) => {
        setError(String(err));
        setStep("role");
      });
  }, []);

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
        setStep("organization");
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
    setStep("signin");
  };

  return (
    <div className="shell">
      {step === "local" && (
        <header className="shell-header">
          <h1>TheOpenPresenter</h1>
          <button className="link" onClick={() => setStep("signin")}>
            Sign in instead
          </button>
        </header>
      )}

      {error && <div className="error">{error}</div>}

      {step === "role" && <ChooseSetup busy={false} onContinue={chooseSetup} />}

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
          footer={<DownloadStatus state={download} />}
          secondary={
            /* Skip rather than "run locally instead": signing in is not an
               alternative to running the server, it is what links the server
               to a cloud organisation. Skipping leaves that unlinked. */
            !finishing ? (
              <button
                className="link"
                onClick={() => {
                  if (runsLocally) void finishLocally();
                  else setStep("local");
                }}
              >
                Skip for now
              </button>
            ) : null
          }
        />
      )}

      {step === "organization" && (
        <ChooseOrganization
          onConnected={() => void finishLocally()}
          onSkip={() => setStep("name")}
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
