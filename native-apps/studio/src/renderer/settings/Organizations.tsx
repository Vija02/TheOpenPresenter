import {
  Button,
  Checkbox,
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
  CircleCheckIcon,
  CloudIcon,
  EllipsisIcon,
  GlobeIcon,
  LogOutIcon,
  PlusIcon,
  ServerIcon,
  Trash2Icon,
  UnlinkIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  type CloudOrganization,
  type ConnectionSummary,
  type LocalOrganization,
  type SignedInAccount,
  api,
  listen,
} from "../bridge/ipc";
import { type AccountRow, groupOrganizations } from "./groupOrganizations";

const CLOUD_URL = "https://theopenpresenter.com";

function hostLabel(url: string): string {
  if (url.replace(/\/+$/, "") === CLOUD_URL) return "the cloud";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

export function Organizations({
  online,
  problem,
  onSwitched,
  onError,
}: {
  problem: string | null;
  /** Whether the window is showing an account's server right now. */
  online: boolean;
  onSwitched: (summary?: ConnectionSummary) => void;
  onError: (message: string | null) => void;
}) {
  const [orgs, setOrgs] = useState<LocalOrganization[] | null>(null);
  const [accounts, setAccounts] = useState<SignedInAccount[] | null>(null);
  const [localAvailable, setLocalAvailable] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [hasLocal, setHasLocal] = useState(false);
  /** The account waiting on a browser sign-in. */
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LocalOrganization | null>(null);
  const [disconnecting, setDisconnecting] = useState<{
    account: SignedInAccount;
    copies: LocalOrganization[];
  } | null>(null);

  const refresh = useCallback(() => {
    api
      .localOrganizations()
      .then((found) => {
        setOrgs(found);
        setLocalAvailable(true);
      })
      .catch(() => {
        // No local server: nothing on this computer to show.
        setOrgs([]);
        setLocalAvailable(false);
      });
    api
      .accounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    const check = () =>
      void Promise.all([api.runtimeStatus(), api.getSettings()])
        // Mid-setup, the setup card owns the switch.
        .then(([status, settings]) =>
          setHasLocal(
            status.available && !!status.current && !settings.pendingLocal,
          ),
        )
        .catch(() => setHasLocal(false));
    check();
    const offListening = listen("runtime:listening", check);
    const offSetup = listen("local-setup:state", check);
    return () => {
      offListening();
      offSetup();
    };
  }, []);
  useEffect(() => listen("runtime:listening", refresh), [refresh]);
  useEffect(() => {
    const offDone = listen("auth:completed", () => {
      setSigningIn(null);
      refresh();
    });
    const offFail = listen("auth:failed", () => setSigningIn(null));
    return () => {
      offDone();
      offFail();
    };
  }, [refresh]);

  const sync = async (account: SignedInAccount, org: CloudOrganization) => {
    onError(null);
    setBusy(`${account.rootUrl}#${org.slug}`);
    try {
      await api.connectCloudOrganization(org, account.rootUrl);
      refresh();
    } catch (err) {
      onError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const switchToLocal = async () => {
    onError(null);
    setBusy("local");
    try {
      onSwitched(await api.switchServer("local"));
    } catch (err) {
      onError(message(err));
    } finally {
      setBusy(null);
    }
  };

  const signInAgain = async (account: SignedInAccount) => {
    onError(null);
    try {
      const result = await api.beginAuth(account.rootUrl);
      if (!result.supported) {
        onError("That server doesn't support signing in from the app.");
        return;
      }
      setSigningIn(account.rootUrl);
    } catch (err) {
      onError(message(err));
    }
  };

  const goOnline = async (account: SignedInAccount) => {
    setBusy("online");
    try {
      await openOnline(account);
    } finally {
      setBusy(null);
    }
  };

  const openOnline = async (account: SignedInAccount, slug?: string) => {
    onError(null);
    try {
      onSwitched(await api.openAccount(account.rootUrl, slug));
      refresh();
    } catch (err) {
      onError(message(err));
    }
  };

  if (orgs === null || accounts === null) {
    return (
      <>
        <h2>Accounts</h2>
        <p className="muted">Loading…</p>
      </>
    );
  }

  const groups = groupOrganizations(accounts, orgs);

  return (
    <>
      <div className="section-head page-head">
        <h2>Accounts</h2>
        <AddAccount onAdded={refresh} onError={onError} />
      </div>

      {problem && <p className="problem">{problem}</p>}

      {groups.accounts.length === 0 && (
        <p className="muted">
          Not signed in to any account. Add one to work online and sync
          organizations.
        </p>
      )}

      {groups.accounts.map(({ account, rows }) => (
        <div key={account.rootUrl} className="org-group">
          <div className="org-group-head">
            <p className="org-group-title">
              {account.isCloud ? (
                <CloudIcon className="size-4" />
              ) : (
                <ServerIcon className="size-4" />
              )}
              {account.label}
              {account.account && (
                <span className="muted">
                  {" "}
                  ·{" "}
                  {account.account.email ??
                    account.account.name ??
                    account.account.username}
                </span>
              )}
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`More options for ${account.label}`}
                >
                  <EllipsisIcon />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                hideArrow
                hideCloseButton
                className="w-48 p-1"
              >
                {account.status === "ok" && !account.current && (
                  <PopoverMenuItem
                    label="Use online"
                    icon={<GlobeIcon className="size-4" />}
                    onClick={() => void openOnline(account)}
                  />
                )}
                <PopoverMenuItem
                  label="Disconnect"
                  icon={<LogOutIcon className="size-4" />}
                  className="org-row-remove"
                  onClick={() =>
                    setDisconnecting({ account, copies: copiesOf(rows) })
                  }
                />
              </PopoverContent>
            </Popover>
          </div>

          {account.status !== "ok" && (
            <div className="account-note">
              <span className="muted">
                {signingIn === account.rootUrl
                  ? "Finish signing in in your browser."
                  : account.status === "signed-out"
                    ? "Signed out."
                    : `Can't reach ${account.label} right now.`}
              </span>
              {account.status === "signed-out" &&
                signingIn !== account.rootUrl && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void signInAgain(account)}
                  >
                    Sign in again
                  </Button>
                )}
            </div>
          )}

          {account.current && (online || account.status === "ok") && (
            <div className="account-mode">
              {online ? (
                <GlobeIcon className="account-mode-icon" aria-hidden />
              ) : (
                <CircleCheckIcon className="account-mode-icon" aria-hidden />
              )}
              <span>{online ? "Online-only mode" : "Local-mode"}</span>
              {online ? (
                hasLocal && (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={busy !== null}
                    onClick={() => void switchToLocal()}
                  >
                    {busy === "local" ? "Switching…" : "Use local-mode"}
                  </Button>
                )
              ) : (
                <Button
                  variant="outline"
                  size="xs"
                  disabled={busy !== null}
                  onClick={() => void goOnline(account)}
                >
                  {busy === "online" ? "Switching…" : "Go online-only"}
                </Button>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <ul className="org-rows">
              {rows.map((row) =>
                row.kind === "synced" ? (
                  <LocalOrganizationRow
                    key={row.key}
                    org={row.local}
                    onRemove={setRemoving}
                  />
                ) : (
                  <li key={row.key} className="org-row">
                    <span className="org-row-name">{row.org.name}</span>
                    <span className="org-row-end">
                      {localAvailable && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={busy !== null}
                          onClick={() => void sync(account, row.org)}
                        >
                          {busy === row.key
                            ? "Syncing…"
                            : "Sync to this computer"}
                        </Button>
                      )}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={`More options for ${row.org.name}`}
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
                            label="Open online"
                            icon={<GlobeIcon className="size-4" />}
                            onClick={() =>
                              void openOnline(account, row.org.slug)
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
          {account.status !== "ok" ? null : account.organizations === null ? (
            <p className="muted">
              Couldn&apos;t load this account&apos;s other organizations.
            </p>
          ) : (
            rows.length === 0 && (
              <p className="muted">No organizations in this account.</p>
            )
          )}
        </div>
      ))}

      {localAvailable && (
        <ThisComputer
          orgs={groups.thisComputer}
          onChanged={refresh}
          onRemove={setRemoving}
          onError={onError}
        />
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

      {disconnecting && (
        <DisconnectAccountDialog
          account={disconnecting.account}
          copies={disconnecting.copies}
          onClose={() => setDisconnecting(null)}
          onDisconnected={() => {
            setDisconnecting(null);
            refresh();
            onSwitched();
          }}
        />
      )}
    </>
  );
}

const copiesOf = (rows: AccountRow[]): LocalOrganization[] =>
  rows.flatMap((row) => (row.kind === "synced" ? [row.local] : []));

function AddAccount({
  onAdded,
  onError,
}: {
  onAdded: () => void;
  onError: (message: string | null) => void;
}) {
  /** The dialog: typing an address, or waiting on the browser. */
  const [open, setOpen] = useState<null | "address" | "waiting">(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [typedError, setTypedError] = useState<string | null>(null);

  const close = () => {
    setOpen(null);
    setAddress("");
    setTypedError(null);
  };

  useEffect(() => {
    const offDone = listen("auth:completed", () => {
      close();
      onAdded();
    });
    const offFail = listen<{ message: string }>("auth:failed", (payload) => {
      close();
      onError(payload.message);
    });
    return () => {
      offDone();
      offFail();
    };
  }, [onAdded, onError]);

  /** Typed addresses report in the dialog; the cloud on the page. */
  const start = async (url: string, typed = false) => {
    const setError = typed ? setTypedError : onError;
    onError(null);
    setTypedError(null);
    setBusy(true);
    try {
      const target = await api.normalizeHost(url);
      if (!target) {
        setError("Enter a server address.");
        return;
      }
      if (!(await api.checkHost(target))) {
        setError(`Couldn't reach ${target}.`);
        return;
      }
      const result = await api.beginAuth(target);
      if (!result.supported) {
        setError("That server doesn't support signing in from the app.");
        return;
      }
      setOpen("waiting");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (open === "waiting") void api.cancelAuth();
    close();
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <PlusIcon />
            Add account
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          hideArrow
          hideCloseButton
          className="w-64 p-1"
        >
          <PopoverMenuItem
            label="TheOpenPresenter Cloud"
            description="Sign in to the hosted service"
            icon={<CloudIcon className="size-4" />}
            onClick={() => void start(CLOUD_URL)}
          />
          <PopoverMenuItem
            label="Another server"
            description="A server your church runs"
            icon={<ServerIcon className="size-4" />}
            onClick={() => setOpen("address")}
          />
        </PopoverContent>
      </Popover>

      <Dialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next && !busy) cancel();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "waiting" ? "Finish signing in" : "Add a server"}
            </DialogTitle>
            <DialogDescription>
              {open === "waiting"
                ? "Sign in in your browser, then come back here."
                : "The address of the server your church runs."}
            </DialogDescription>
          </DialogHeader>
          {open === "address" && (
            <DialogBody>
              <div className="add-account">
                <Input
                  type="text"
                  value={address}
                  autoFocus
                  placeholder="presenter.mychurch.org"
                  disabled={busy}
                  onChange={(event) => setAddress(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && address.trim()) {
                      void start(address, true);
                    }
                  }}
                />
                {typedError && (
                  <p className="remove-org-danger">{typedError}</p>
                )}
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={cancel}>
              Cancel
            </Button>
            {open === "address" && (
              <Button
                disabled={busy || !address.trim()}
                onClick={() => void start(address, true)}
              >
                {busy ? "Connecting…" : "Sign in"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ThisComputer({
  orgs,
  onChanged,
  onRemove,
  onError,
}: {
  orgs: LocalOrganization[];
  onChanged: () => void;
  onRemove: (org: LocalOrganization) => void;
  onError: (message: string | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onError(null);
    setBusy(true);
    try {
      await api.createLocalOrganization(trimmed);
      setName("");
      setCreating(false);
      onChanged();
    } catch (err) {
      onError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="org-group">
      <div className="org-group-head">
        <p className="org-group-title">On this computer</p>
        {!creating && (
          <Button variant="outline" size="xs" onClick={() => setCreating(true)}>
            <PlusIcon />
            New local organization
          </Button>
        )}
      </div>

      {creating && (
        <div className="row">
          <Input
            type="text"
            value={name}
            placeholder="St Mary's Church"
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
              if (event.key === "Escape") setCreating(false);
            }}
          />
          <Button
            variant="outline"
            disabled={busy || !name.trim()}
            onClick={() => void create()}
          >
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button variant="link" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      )}

      {orgs.length > 0 ? (
        <ul className="org-rows">
          {orgs.map((org) => (
            <LocalOrganizationRow key={org.id} org={org} onRemove={onRemove} />
          ))}
        </ul>
      ) : (
        !creating && (
          <p className="muted">Nothing here that isn&apos;t in an account.</p>
        )
      )}
    </div>
  );
}

function LocalOrganizationRow({
  org,
  onRemove,
}: {
  org: LocalOrganization;
  onRemove: (org: LocalOrganization) => void;
}) {
  return (
    <li className="org-row">
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
                label={org.cloudHost ? "Unlink" : "Remove"}
                icon={
                  org.cloudHost ? (
                    <UnlinkIcon className="size-4" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )
                }
                className="org-row-remove"
                onClick={() => onRemove(org)}
              />
            </PopoverContent>
          </Popover>
        )}
      </span>
    </li>
  );
}

function DisconnectAccountDialog({
  account,
  copies,
  onClose,
  onDisconnected,
}: {
  account: SignedInAccount;
  copies: LocalOrganization[];
  onClose: () => void;
  onDisconnected: () => void;
}) {
  const [deleteCopies, setDeleteCopies] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.disconnectAccount(account.rootUrl, deleteCopies);
      onDisconnected();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  };

  const names = copies.map((org) => org.name || org.slug).join(", ");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent size="lg" className="remove-org-dialog">
        <DialogHeader>
          <DialogTitle>Disconnect {account.label}?</DialogTitle>
          <DialogDescription>
            You&apos;ll be signed out
            {account.account
              ? ` of ${account.account.email ?? account.account.username}`
              : ""}
            , and its organizations will no longer show here. Nothing is deleted
            on {account.label}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="remove-org">
            {copies.length > 0 ? (
              <>
                <p>
                  {copies.length === 1
                    ? `${names} is on this computer. It will stop syncing and stay here as local only.`
                    : `${copies.length} organizations are on this computer (${names}). They will stop syncing and stay here as local only.`}
                </p>
                <label className="disconnect-delete">
                  <Checkbox
                    checked={deleteCopies}
                    disabled={busy}
                    onCheckedChange={(value) => setDeleteCopies(value === true)}
                  />
                  <span>
                    Also delete {copies.length === 1 ? "it" : "them"} from this
                    computer
                  </span>
                </label>
                {deleteCopies && (
                  <p className="remove-org-danger">
                    Changes not yet synced to {account.label} will be lost.
                  </p>
                )}
              </>
            ) : (
              <p>None of its organizations are on this computer.</p>
            )}
            {error && <p className="remove-org-danger">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            {busy
              ? "Disconnecting…"
              : deleteCopies
                ? "Disconnect and delete"
                : "Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
            {synced ? `Unlink ${name} from this computer?` : `Delete ${name}?`}
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
                ? "Unlink and delete copy"
                : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
