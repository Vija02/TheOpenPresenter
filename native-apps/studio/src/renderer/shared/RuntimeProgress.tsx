import type { ProgressPayload } from "../bridge/ipc";
import { describeProgress } from "../loading/phase";

export function RuntimeProgress({
  progress,
}: {
  progress: ProgressPayload | null;
}) {
  const view = progress
    ? describeProgress(progress)
    : { label: "Contacting the release server", percent: null };

  return (
    <div className="progress" role="status">
      <div className="progress-label">
        {view.label}
        {view.percent !== null && ` · ${view.percent}%`}
      </div>
      <div
        className={`progress-track ${view.percent === null ? "indeterminate" : ""}`}
      >
        <div
          className="progress-bar"
          style={
            view.percent === null ? undefined : { width: `${view.percent}%` }
          }
        />
      </div>
    </div>
  );
}
