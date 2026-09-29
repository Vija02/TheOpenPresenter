/** Manager progress phases: install and update only. */
export function describePhase(phase: string): string | null {
  if (phase.startsWith("resolved:")) return "Checking for updates";
  if (phase.startsWith("activated:")) return "Almost ready";

  switch (phase) {
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
