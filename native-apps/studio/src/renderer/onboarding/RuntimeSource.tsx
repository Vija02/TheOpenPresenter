import { useEffect, useState } from "react";

import { api } from "../bridge/ipc";

/**
 * Where runtime releases are downloaded from. Normally nobody touches this: it
 * exists for testing against a locally published release, and for a church on
 * a locked-down network installing from a USB stick rather than the internet.
 */
export function RuntimeSource({ onChanged }: { onChanged: () => void }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings().then((settings) => {
      setValue(settings.runtimeSource ?? "");
      setSaved(settings.runtimeSource ?? "");
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      // Restarting the manager is handled in the main process, because the
      // source is a launch argument rather than something it re-reads.
      await api.updateSettings({ runtimeSource: value.trim() });
      setSaved(value.trim());
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <p className="muted small">
        Downloading from {saved || "the default release server"}.{" "}
        <button className="link" onClick={() => setOpen(true)}>
          Change
        </button>
      </p>
    );
  }

  return (
    <div className="source-editor">
      <label className="muted small" htmlFor="runtime-source">
        Release source: an https:// URL, or a path to a directory containing a
        published release. Leave empty for the default.
      </label>
      <div className="row">
        <input
          id="runtime-source"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://runtime.theopenpresenter.com"
          spellCheck={false}
        />
        <button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
