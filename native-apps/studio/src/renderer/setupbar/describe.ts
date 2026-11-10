import type {
  FirstSyncState,
  LocalSetupState,
  SetupBarContent,
  SyncView,
} from "../bridge/ipc";
import { describeProgress } from "../loading/phase";

export type SetupBarView = {
  label: string;
  /** Null sweeps the bar; undefined hides it. */
  percent: number | null | undefined;
  /** How loudly to offer the switch, if at all. */
  switchButton: "none" | "quiet" | "primary";
  retry: boolean;
  tone: "normal" | "warn";
};

/** What the bar says at each point of the offline setup. */
export function describeSetup(state: LocalSetupState): SetupBarView {
  const quiet = state.canSwitch ? "quiet" : "none";

  switch (state.phase) {
    case "downloading": {
      const view = state.progress
        ? describeProgress(state.progress)
        : { label: "Downloading", percent: null };
      return {
        label: `Getting offline mode ready · ${view.label}`,
        percent: view.percent,
        switchButton: "none",
        retry: false,
        tone: "normal",
      };
    }
    case "starting":
      return {
        label: "Getting offline mode ready · Starting up",
        percent: null,
        switchButton: "none",
        retry: false,
        tone: "normal",
      };
    case "syncing":
      return {
        ...describeCopy("your projects", "media", state),
        switchButton: quiet,
        retry: false,
        tone: "normal",
      };
    case "ready":
      return {
        label: state.syncFailed
          ? "Ready to work offline. Some projects or media didn't copy yet."
          : "Ready to work offline",
        percent: undefined,
        switchButton: "primary",
        retry: false,
        tone: "normal",
      };
    case "failed":
      return {
        label: "Couldn't get offline mode ready",
        percent: undefined,
        switchButton: quiet,
        retry: true,
        tone: "warn",
      };
    default:
      return {
        label: "",
        percent: undefined,
        switchButton: "none",
        retry: false,
        tone: "normal",
      };
  }
}

const HIDDEN: SetupBarView = {
  label: "",
  percent: undefined,
  switchButton: "none",
  retry: false,
  tone: "normal",
};

export function describeBar(content: SetupBarContent): SetupBarView {
  if (!content) return HIDDEN;
  return content.kind === "setup"
    ? describeSetup(content.state)
    : describeSync(content.state);
}

/** "Grace", "Grace and Hope", or "3 organizations". */
function who(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "your organization";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.length} organizations`;
}

/** Projects first, then media by bytes where known. */
function describeCopy(
  projects: string,
  media: string,
  view: SyncView,
): { label: string; percent: number | null } {
  const what = view.stage === "media" ? media : projects;
  const done = view.bytes?.done ?? view.synced;
  const total = view.bytes?.total ?? view.total;
  return {
    label: view.slow
      ? `Copying ${what} is taking longer than usual`
      : view.total > 0
        ? `Copying ${what} · ${view.synced} of ${view.total}`
        : `Copying ${what}`,
    percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null,
  };
}

/** Organizations copied after setup, from settings. */
export function describeSync(state: FirstSyncState): SetupBarView {
  switch (state.phase) {
    case "syncing": {
      const name = who(state.names);
      return {
        ...describeCopy(name, `media for ${name}`, state),
        switchButton: "none",
        retry: false,
        tone: "normal",
      };
    }
    case "done": {
      const name = who(state.names);
      return state.failed
        ? {
            label: `Some of ${name} didn't copy yet. It'll keep trying.`,
            percent: undefined,
            switchButton: "none",
            retry: false,
            tone: "warn",
          }
        : {
            label: `${name} ${state.names.length > 1 ? "are" : "is"} ready on this computer`,
            percent: undefined,
            switchButton: "none",
            retry: false,
            tone: "normal",
          };
    }
    default:
      return HIDDEN;
  }
}
