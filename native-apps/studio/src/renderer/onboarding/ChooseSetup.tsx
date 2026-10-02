import { Button, Option } from "@repo/ui";
import { useState } from "react";

import { Logo } from "../shared/Logo";
import { CHANNELS, DEFAULT_CHANNEL, channelNote } from "../shared/channels";

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
  initialKind,
  initialChannel,
}: {
  onContinue: (choice: SetupChoice) => void;
  busy: boolean;
  initialKind?: SetupKind;
  initialChannel?: string;
}) {
  const [kind, setKind] = useState<SetupKind>(initialKind ?? "complete");
  const [channel, setChannel] = useState(initialChannel ?? DEFAULT_CHANNEL);
  // Open when a non-default channel is already set, so a returning user can
  // see what they picked instead of it looking like the default.
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initialChannel && initialChannel !== DEFAULT_CHANNEL),
  );

  return (
    <div className="onboarding">
      <div className="hero">
        <Logo />
        <h2>Set up TheOpenPresenter</h2>
        <p className="muted">You can change this later from the menu.</p>
      </div>

      <div
        className="choices ui--option-group"
        role="radiogroup"
        aria-label="Setup type"
      >
        <Option
          title={
            <span className="choice-head">
              Complete
              <span className="choice-tag">Recommended</span>
            </span>
          }
          description="Runs everything on this computer. Works without internet, and other screens and phones connect to it. Downloads about 140MB."
          selected={kind === "complete"}
          disabled={busy}
          onClick={() => setKind("complete")}
        />

        <Option
          title="Minimal"
          description="Connects to another computer or the cloud. Nothing to download."
          selected={kind === "minimal"}
          disabled={busy}
          onClick={() => setKind("minimal")}
        />
      </div>

      {kind === "complete" && (
        <>
          <Button
            type="button"
            variant="link"
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? "Hide advanced" : "Advanced"}
          </Button>

          {showAdvanced && (
            <div className="advanced-panel">
              <label className="field">
                <span>Version to download</span>
                <select
                  value={channel}
                  disabled={busy}
                  onChange={(event) => setChannel(event.target.value)}
                >
                  {CHANNELS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted small">{channelNote(channel)}</p>
            </div>
          )}
        </>
      )}

      <Button disabled={busy} onClick={() => onContinue({ kind, channel })}>
        Continue
      </Button>
    </div>
  );
}
