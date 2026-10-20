/** Manager progress phases: install and update only. */
export function describePhase(phase: string): string | null {
  if (phase.startsWith("resolved:")) return "Checking for updates";
  if (phase.startsWith("activated:")) return "Almost ready";

  switch (phase) {
    case "fetch":
    case "download":
      return "Downloading";
    case "assemble":
      return "Installing";
    case "starting":
      return "Starting up";
    default:
      return null;
  }
}

export function describeLogLine(line: string): string | null {
  const text = line.toLowerCase();

  if (text.includes("running migrations")) return "Updating the database";
  if (text.includes("database system is ready")) return "Database ready";
  if (text.includes("initializing node server")) return "Starting the database";
  if (text.includes("starting worker")) return "Starting background jobs";
  if (text.includes("starting node server")) return "Starting the server";
  if (text.includes("plugins initialized")) return "Loading plugins";
  if (text.includes("listening on port")) return "Ready";

  return null;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export type ProgressView = {
  label: string;
  /** Null when there is nothing to measure, so the bar should sweep. */
  percent: number | null;
};

/**
 * One manager progress event as a line a person can read. `fetch` counts
 * bytes of a pack arriving; `download` and `assemble` count files.
 */
export function describeProgress(progress: {
  phase: string;
  done: number;
  total: number;
}): ProgressView {
  const { phase, done, total } = progress;
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;

  if (phase === "fetch") {
    return {
      label:
        total > 0
          ? `Downloading ${formatBytes(done)} of ${formatBytes(total)}`
          : `Downloading ${formatBytes(done)}`,
      percent,
    };
  }
  if (phase === "download") {
    return {
      label:
        total > 0
          ? `Preparing files (${done.toLocaleString()} of ${total.toLocaleString()})`
          : "Preparing files",
      percent,
    };
  }
  if (phase === "assemble") {
    return { label: "Installing", percent };
  }

  // Phases without a meaningful count: show the words, sweep the bar.
  return { label: describePhase(phase) ?? "Working", percent: null };
}
