import { Alert, Button } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";

import {
  type CloudOrganization,
  type Mode,
  type Settings,
  api,
} from "../bridge/ipc";
import { ChooseSetup, type SetupChoice } from "./ChooseSetup";
import { DownloadStatus } from "./DownloadStatus";
import { FinishAccount } from "./FinishAccount";
import { LocalRuntime } from "./LocalRuntime";
import { PickOrganizations } from "./PickOrganizations";
import { SignIn } from "./SignIn";
import { canGoBack, current, pop, push } from "./history";
import { type Step, firstStep } from "./steps";
import { useRuntimeDownload } from "./useRuntimeDownload";

/**
 * First-run setup. One question decides everything after it: should this
 * machine be able to work offline? If so the runtime download starts
 * immediately. Either way the user signs in and starts working online; a
 * complete setup also picks which organizations to copy, and the rest
 * (download, local server, copying) finishes in the background, with a bar in
 * the app window offering the switch to Local once it is ready.
 */
export function Onboarding() {
  const [history, setHistory] = useState<Step[]>(["role"]);
  const step = current(history);
  const [settings, setSettings] = useState<Settings>({});
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  /** The server signed in to, kept for the steps that follow sign-in. */
  const [signedInUrl, setSignedInUrl] = useState<string>("");
  const [signedInMode, setSignedInMode] = useState<Mode>("cloud");
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
   * No account: run on this computer only. The one path that has to wait for
   * the download, because there is nothing to work in until it is done.
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
   * Open the app. Straight into Local when the runtime is already here;
   * otherwise online at once, with offline setup finishing in the background.
   * The app window takes over from here.
   */
  const goOnline = useCallback(
    async (organizations: CloudOrganization[]) => {
      setError(null);
      setFinishing(true);
      try {
        const { direct } = await api.localSetupBegin({
          rootUrl: signedInUrl,
          organizations: organizations.map(({ slug, name }) => ({
            slug,
            name,
          })),
        });
        // Already downloaded: the main process has opened Local itself.
        // Opens on the first organization being copied, if any.
        if (!direct) {
          await api.connect(signedInMode, signedInUrl, organizations[0]?.slug);
        }
      } catch (err) {
        setError(String(err));
        setFinishing(false);
      }
    },
    [signedInUrl, signedInMode],
  );

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

      setSignedInUrl(rootUrl);
      setSignedInMode(chosen);

      // A new account has no organization until it finishes onboarding
      const status = await api.cloudOnboarding(rootUrl).catch(() => null);
      if (status && !status.completed && !status.hasOrganization) {
        goTo("account");
        return;
      }

      goTo("organization");
    },
    [runsLocally, goTo],
  );

  const onAccountReady = useCallback(() => goTo("organization"), [goTo]);

  const chooseSetup = (choice: SetupChoice) => {
    const complete = choice.kind === "complete";
    // First because it is the long pole and sign-in does not need it. Failure
    // is recorded in the hook and shown by DownloadStatus, so the rejection is
    // absorbed here; `wait` re-raises it for whoever needs it.
    if (complete) void download.start(choice.channel).catch(() => undefined);
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
            download.active ? "Finishing the download…" : "Starting up…"
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
               to a cloud organization. Skipping leaves that unlinked.

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

      {step === "account" && (
        <FinishAccount rootUrl={signedInUrl} onDone={onAccountReady} />
      )}

      {step === "organization" && (
        <PickOrganizations
          rootUrl={signedInUrl}
          busy={finishing}
          onContinue={(organizations) => void goOnline(organizations)}
          onError={setError}
          footer={<DownloadStatus state={download} />}
        />
      )}

      {step === "local" && <LocalRuntime onError={setError} />}
    </div>
  );
}
