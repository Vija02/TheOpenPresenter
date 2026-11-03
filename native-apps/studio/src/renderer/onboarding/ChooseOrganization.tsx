import { Button } from "@repo/ui";
import { useEffect, useRef, useState } from "react";

import { type CloudOrganization, type SyncProgress, api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";

const POLL_MS = 500;
// Give up on a run that never starts (sync failed to queue) or runs long.
const NO_RUN_TIMEOUT_MS = 10_000;
const SYNC_TIMEOUT_MS = 60_000;

/**
 * Pick which cloud organisation this computer works with. Choosing creates the
 * local mirror and points it at this org in one step, so there is no separate
 * "target organisation" to configure.
 */
export function ChooseOrganization({
  onConnected,
  onSkip,
  onError,
}: {
  onConnected: (organizationSlug?: string) => void;
  onSkip: () => void;
  onError: (message: string) => void;
}) {
  const [options, setOptions] = useState<CloudOrganization[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<SyncProgress | "waiting" | null>(null);
  const skipWait = useRef<() => void>(() => undefined);

  useEffect(() => {
    api
      .cloudOrganizations()
      .then(setOptions)
      .catch((err) => {
        onError(err instanceof Error ? err.message : String(err));
        setOptions([]);
      });
  }, [onError]);

  const connect = async (org: CloudOrganization) => {
    setBusy(org.slug);
    try {
      const connection = await api.connectCloudOrganization(org);
      await waitForProjects(connection.id);
      onConnected(connection.localOrganizationSlug);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

  const waitForProjects = (cloudConnectionId: string) =>
    new Promise<void>((resolve) => {
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout>;
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      skipWait.current = done;
      setSyncing("waiting");

      const poll = async () => {
        const progress = await api
          .syncProgress(cloudConnectionId)
          .catch(() => null);
        const elapsed = Date.now() - started;
        if (progress) setSyncing(progress);
        if (
          (progress &&
            progress.status !== "PENDING" &&
            progress.status !== "IN_PROGRESS") ||
          (!progress && elapsed > NO_RUN_TIMEOUT_MS) ||
          elapsed > SYNC_TIMEOUT_MS
        ) {
          done();
          return;
        }
        timer = setTimeout(() => void poll(), POLL_MS);
      };
      void poll();
    });

  if (syncing) {
    return (
      <section className="onboarding">
        <Logo />
        <h2>Getting your projects</h2>
        <p className="muted">
          {syncing !== "waiting" && syncing.projectsToSync > 0
            ? `${syncing.syncedProjects} of ${syncing.projectsToSync} projects`
            : "Checking the cloud…"}
        </p>
        <p className="muted">Media keeps downloading in the background.</p>
        <div className="row">
          <Button variant="link" onClick={() => skipWait.current()}>
            Continue now
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="onboarding">
      <Logo />
      <h2>Choose your organisation</h2>
      <p className="muted">
        Your projects will be kept in step between this computer and the
        organisation you pick.
      </p>

      {options === null && <p className="muted">Loading…</p>}

      {options?.length === 0 && (
        <p className="muted">
          This account has no organisations yet. You can carry on without one
          and connect later.
        </p>
      )}

      {options !== null &&
        options.length > 0 &&
        options.every((org) => org.connected) && (
          <p className="muted">
            Every organization in this account is already set up on this
            computer.
          </p>
        )}

      <ul className="org-list">
        {options?.map((org) => (
          <li key={org.slug}>
            <Button
              variant="outline"
              onClick={() => void connect(org)}
              disabled={busy !== null || org.connected}
              className="org-option"
            >
              <span className="org-name">{org.name}</span>
              {org.connected && (
                <span className="muted">Already on this computer</span>
              )}
              {busy === org.slug && <span className="muted">Connecting…</span>}
            </Button>
          </li>
        ))}
      </ul>

      <div className="row">
        <Button variant="link" onClick={onSkip} disabled={busy !== null}>
          Carry on without connecting
        </Button>
      </div>
    </section>
  );
}
