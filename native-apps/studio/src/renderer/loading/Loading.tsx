import { useEffect, useState } from "react";

import { type ProgressPayload, listen } from "../bridge/ipc";
import { Logo } from "../shared/Logo";
import { describeLogLine, describePhase } from "./phase";

/** Initial app open loading screen */
export function Loading() {
  const [phase, setPhase] = useState("Starting up");
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  useEffect(() => {
    const offProgress = listen<ProgressPayload>(
      "runtime:progress",
      (payload) => {
        setProgress(payload);
        const friendly = describePhase(payload.phase ?? "");
        if (friendly) setPhase(friendly);
      },
    );

    const offLog = listen<string>("runtime:log", (line) => {
      const friendly = describeLogLine(String(line ?? ""));
      if (friendly) setPhase(friendly);
    });

    return () => {
      offProgress?.();
      offLog?.();
    };
  }, []);

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : null;

  return (
    <section className="loading">
      <Logo size={72} />
      <h1>TheOpenPresenter</h1>

      <div className={`loading-bar ${pct === null ? "indeterminate" : ""}`}>
        <div
          className="loading-fill"
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>

      <p className="loading-phase">
        {phase}
        {pct !== null && phase === "Downloading" ? ` ${pct}%` : ""}
      </p>
    </section>
  );
}
