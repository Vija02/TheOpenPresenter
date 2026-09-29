import type { DownloadState } from "./useRuntimeDownload";

function percent(state: DownloadState): number | null {
  const p = state.progress;
  if (!p || !p.total) return null;
  return Math.min(100, Math.round((p.done / p.total) * 100));
}

/**
 * A quiet line showing the runtime download while the user does something
 * else. Deliberately not a blocking progress screen: it is background work
 * that happens to be visible, not a step anyone is waiting on.
 */
export function DownloadStatus({ state }: { state: DownloadState }) {
  if (state.failed) {
    return (
      <p className="download-status warn">
        The download did not finish. You can still sign in; it will retry when
        you open the main computer.
      </p>
    );
  }

  if (state.done) {
    return <p className="download-status">Ready to run on this computer.</p>;
  }

  if (!state.active) return null;

  const pct = percent(state);
  const phase =
    state.progress?.phase === "install" ? "Installing" : "Downloading";

  return (
    <div className="download-status">
      <div className="bar" aria-hidden>
        <div className="bar-fill" style={{ width: `${pct ?? 5}%` }} />
      </div>
      <span>
        {phase}
        {pct === null ? "…" : ` ${pct}%`} in the background
      </span>
    </div>
  );
}
