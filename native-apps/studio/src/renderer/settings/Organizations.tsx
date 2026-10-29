import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverMenuItem,
  PopoverTrigger,
} from "@repo/ui";
import {
  ChevronDownIcon,
  CloudIcon,
  EllipsisIcon,
  HardDriveIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
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
  const [removing, setRemoving] = useState<LocalOrganization | null>(null);

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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon />
                Add new
                <ChevronDownIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              hideArrow
              hideCloseButton
              className="w-64 p-1"
            >
              <PopoverMenuItem
                label="Local organization"
                description="Kept on this computer only"
                icon={<HardDriveIcon className="size-4" />}
                onClick={() => setMode("creating")}
              />
              <PopoverMenuItem
                label="Cloud organization"
                description="Sync with cloud server"
                icon={<CloudIcon className="size-4" />}
                onClick={() => void startConnecting()}
              />
            </PopoverContent>
          </Popover>
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
              <span className="org-row-end">
                {org.cloudHost ? (
                  <span className="org-row-sync" title={org.cloudHost}>
                    Synced to {hostLabel(org.cloudHost)}
                  </span>
                ) : (
                  <span className="muted">Local only</span>
                )}
                {org.isOwner && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label={`More options for ${org.name || org.slug}`}
                      >
                        <EllipsisIcon />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      hideArrow
                      hideCloseButton
                      className="w-44 p-1"
                    >
                      <PopoverMenuItem
                        label="Remove"
                        icon={<Trash2Icon className="size-4" />}
                        className="org-row-remove"
                        onClick={() => setRemoving(org)}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </span>
            </li>
          ))}
        </ul>
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

      {removing && (
        <RemoveOrganizationDialog
          org={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setRemoving(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function RemoveOrganizationDialog({
  org,
  onClose,
  onRemoved,
}: {
  org: LocalOrganization;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const name = org.name || org.slug;
  const synced = !!org.cloudHost;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim() === name.trim();

  const remove = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.removeOrganization(org.id);
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent size="lg" className="remove-org-dialog">
        <DialogHeader>
          <DialogTitle>
            {synced ? `Remove ${name} from this computer?` : `Delete ${name}?`}
          </DialogTitle>
          <DialogDescription>
            {synced
              ? `This stops syncing with ${hostLabel(org.cloudHost!)} and deletes the copy on this computer.`
              : "This organization is only on this computer, so this cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="remove-org">
            <p>Deleted from this computer:</p>
            <ul>
              <li>{count(org.projectCount, "project")}</li>
              <li>{count(org.mediaCount, "file")} in the media library</li>
              <li>Songs, Bible settings, looks and everything else in it</li>
            </ul>
            {synced ? (
              <p className="remove-org-safe">
                Nothing is deleted on {hostLabel(org.cloudHost!)}
                {org.cloudOrganizationSlug
                  ? ` (${org.cloudOrganizationSlug})`
                  : ""}
                . You can connect and download it again.
              </p>
            ) : (
              <p className="remove-org-danger">
                There is no other copy. Once deleted, it is gone for good.
              </p>
            )}
            <label className="remove-org-confirm">
              <span>
                Type <strong>{name}</strong> to confirm
              </span>
              <Input
                type="text"
                value={typed}
                autoFocus
                disabled={busy}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void remove();
                }}
              />
            </label>
            {error && <p className="remove-org-danger">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!confirmed || busy}
            onClick={() => void remove()}
          >
            {busy
              ? "Deleting…"
              : synced
                ? "Stop syncing and delete"
                : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
