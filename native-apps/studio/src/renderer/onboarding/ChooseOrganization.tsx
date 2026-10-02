import { Button } from "@repo/ui";
import { useEffect, useState } from "react";

import { type CloudOrganization, api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";

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
  onConnected: () => void;
  onSkip: () => void;
  onError: (message: string) => void;
}) {
  const [options, setOptions] = useState<CloudOrganization[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      await api.connectCloudOrganization(org);
      onConnected();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  };

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
