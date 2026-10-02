import { Button, Input } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";

import {
  type CloudOrganization,
  type LocalOrganization,
  api,
} from "../bridge/ipc";

/**
 * The Local organizations on this computer
 */

type Mode = "idle" | "creating" | "connecting";

const CLOUD_URL = "https://theopenpresenter.com";

function hostLabel(url: string): string {
  if (url.replace(/\/+$/, "") === CLOUD_URL) return "the cloud";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function Organizations({
  onError,
}: {
  onError: (message: string | null) => void;
}) {
  const [orgs, setOrgs] = useState<LocalOrganization[] | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [newName, setNewName] = useState("");
  const [cloudOptions, setCloudOptions] = useState<CloudOrganization[] | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .localOrganizations()
      .then(setOrgs)
      .catch((err) => {
        onError(err instanceof Error ? err.message : String(err));
        setOrgs([]);
      });
  }, [onError]);

  useEffect(refresh, [refresh]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    onError(null);
    setBusy("create");
    try {
      await api.createLocalOrganization(name);
      setNewName("");
      setMode("idle");
      refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const startConnecting = async () => {
    onError(null);
    setMode("connecting");
    setCloudOptions(null);
    try {
      setCloudOptions(await api.cloudOrganizations());
    } catch (err) {
      // Usually "sign in to the cloud first", which is a legitimate answer
      // rather than a fault: an empty list with the error shown is clearer
      // than a spinner that never resolves.
      onError(err instanceof Error ? err.message : String(err));
      setCloudOptions([]);
    }
  };

  const connect = async (org: CloudOrganization) => {
    onError(null);
    setBusy(org.slug);
    try {
      await api.connectCloudOrganization(org);
      setMode("idle");
      refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="section-head">
        <h3>Organizations</h3>
        {mode === "idle" && (
          <Button variant="link" onClick={() => setMode("creating")}>
            New local organization
          </Button>
        )}
      </div>

      {orgs === null ? (
        <p className="muted">Loading…</p>
      ) : orgs.length === 0 ? (
        <p className="muted">
          No organizations yet. Create one, or connect an existing cloud
          organization to this computer.
        </p>
      ) : (
        <ul className="org-rows">
          {orgs.map((org) => (
            <li key={org.id} className="org-row">
              <span className="org-row-name">{org.name || org.slug}</span>
              {org.cloudHost ? (
                <span className="org-row-sync" title={org.cloudHost}>
                  Synced to {hostLabel(org.cloudHost)}
                </span>
              ) : (
                <span className="muted">On this computer only</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {mode === "idle" && (
        <div className="row">
          <Button variant="outline" onClick={() => void startConnecting()}>
            Connect a cloud organization
          </Button>
        </div>
      )}

      {mode === "creating" && (
        <div className="row">
          <Input
            type="text"
            value={newName}
            placeholder="St Mary's Church"
            autoFocus
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
              if (event.key === "Escape") setMode("idle");
            }}
          />
          <Button
            variant="outline"
            disabled={busy !== null || !newName.trim()}
            onClick={() => void create()}
          >
            {busy === "create" ? "Creating…" : "Create"}
          </Button>
          <Button variant="link" onClick={() => setMode("idle")}>
            Cancel
          </Button>
        </div>
      )}

      {mode === "connecting" && (
        <div className="connect-list">
          {cloudOptions === null ? (
            <p className="muted">Looking for cloud organizations…</p>
          ) : cloudOptions.length === 0 ? (
            <p className="muted">
              Nothing to connect. Sign in to the cloud from this computer first.
            </p>
          ) : (
            <ul className="org-rows">
              {cloudOptions.map((org) => (
                <li key={org.slug} className="org-row">
                  <span className="org-row-name">{org.name}</span>
                  {org.connected ? (
                    <span className="muted">Already connected</span>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void connect(org)}
                    >
                      {busy === org.slug ? "Connecting…" : "Connect"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Button variant="link" onClick={() => setMode("idle")}>
            Cancel
          </Button>
        </div>
      )}
    </>
  );
}
