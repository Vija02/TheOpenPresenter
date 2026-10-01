import { Button } from "@repo/ui";
import { useEffect, useState } from "react";

import { api } from "../bridge/ipc";

type Paths = {
  root: string;
  versions: string;
  data: string;
  cache: string;
  logs: string;
};

/**
 * Where the runtime keeps its files. People reasonably ask "where did my 500MB
 * go" and "where is my database", and the honest answer is a path. It also
 * stops the CLI and the app looking like they disagree.
 */
export function RuntimePaths() {
  const [paths, setPaths] = useState<Paths | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !paths) {
      api
        .runtimePaths()
        .then(setPaths)
        .catch(() => setPaths(null));
    }
  }, [open, paths]);

  if (!open) {
    return (
      <p className="muted small">
        <Button variant="link" onClick={() => setOpen(true)}>
          Where are these files?
        </Button>
      </p>
    );
  }

  return (
    <div className="paths">
      <p className="muted small">
        The command line tool uses these same folders, so anything you do there
        shows up here.
      </p>

      {paths ? (
        <dl className="paths-list">
          <dt>Your work</dt>
          <dd>
            <code>{paths.data}</code>
            <span className="muted">
              {" "}
              — presentations and media. Back this up.
            </span>
          </dd>

          <dt>Downloaded server</dt>
          <dd>
            <code>{paths.versions}</code>
          </dd>

          <dt>Logs</dt>
          <dd>
            <code>{paths.logs}</code>
          </dd>
        </dl>
      ) : (
        <p className="muted small">Reading…</p>
      )}

      <div className="row">
        <Button
          variant="outline"
          onClick={() => void api.revealRuntimeFolder("data")}
        >
          Open my work folder
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Hide
        </Button>
      </div>
    </div>
  );
}
