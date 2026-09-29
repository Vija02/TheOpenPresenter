import { useState } from "react";

import { Logo } from "../shared/Logo";

export type SetupKind = "complete" | "minimal";

export type SetupChoice = { kind: SetupKind; channel: string };

/**
 * The first screen: an installer-style choice, preselected. Framed as complete
 * vs minimal because that is the shape people recognise from installers, and
 * it makes the safe option a default rather than a decision.
 *
 * The difference that matters is the download: complete fetches the runtime so
 * this machine can serve on its own, minimal does not.
 */
export function ChooseSetup({
  onContinue,
  busy,
}: {
  onContinue: (choice: SetupChoice) => void;
  busy: boolean;
}) {
  const [kind, setKind] = useState<SetupKind>("complete");
  const [channel, setChannel] = useState("stable");
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="onboarding">
      <div className="hero">
        <Logo />
        <h2>Set up TheOpenPresenter</h2>
        <p className="muted">You can change this later from the menu.</p>
      </div>

      <div className="choices" role="radiogroup" aria-label="Setup type">
        <button
          type="button"
          role="radio"
          aria-checked={kind === "complete"}
          className="choice"
          disabled={busy}
          onClick={() => setKind("complete")}
        >
          <span className="choice-head">
            <span className="choice-title">Complete</span>
            <span className="choice-tag">Recommended</span>
          </span>
          <span className="choice-note">
            Runs everything on this computer. Works without internet, and other
            screens and phones connect to it. Downloads about 140MB.
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={kind === "minimal"}
          className="choice"
          disabled={busy}
          onClick={() => setKind("minimal")}
        >
          <span className="choice-head">
            <span className="choice-title">Minimal</span>
          </span>
          <span className="choice-note">
            Connects to another computer or the cloud. Nothing to download.
          </span>
        </button>
      </div>

      {/* Between the choices and Continue, so it reads as a footnote rather
          than a third option. Collapsed because almost nobody wants a
          nightly, and offering it prominently invites picking it. */}
      <button
        type="button"
        className="link advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? "Hide advanced" : "Advanced"}
      </button>

      {showAdvanced && (
        <div className="advanced-panel">
          <label className="field">
            <span>Version to download</span>
            <select
              value={channel}
              disabled={busy || kind === "minimal"}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="stable">Stable (recommended)</option>
              <option value="nightly">Nightly (latest, may break)</option>
            </select>
          </label>
          <p className="muted small">
            {kind === "minimal"
              ? "Only applies when this computer runs everything."
              : channel === "nightly"
                ? "Built from the newest code. Expect rough edges."
                : "Tested releases."}
          </p>
        </div>
      )}

      <button
        className="primary"
        disabled={busy}
        onClick={() => onContinue({ kind, channel })}
      >
        Continue
      </button>
    </div>
  );
}
