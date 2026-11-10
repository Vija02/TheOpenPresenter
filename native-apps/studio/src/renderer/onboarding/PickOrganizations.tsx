import { Button, Option } from "@repo/ui";
import { useEffect, useRef, useState } from "react";

import { type CloudOrganization, api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";

/**
 * Choose which organizations to keep on this computer. Nothing is copied yet:
 * that happens in the background once the download is done, while the user is
 * already working online.
 */
export function PickOrganizations({
  rootUrl,
  footer,
  busy,
  onContinue,
  onError,
}: {
  rootUrl: string;
  footer?: React.ReactNode;
  busy: boolean;
  onContinue: (organizations: CloudOrganization[]) => void;
  onError: (message: string) => void;
}) {
  const [options, setOptions] = useState<CloudOrganization[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // Effects run twice in development; continuing twice would open twice.
  const autoContinued = useRef(false);

  useEffect(() => {
    api
      .cloudOrganizations(rootUrl)
      .then((organizations) => {
        setOptions(organizations);
        // One organization is no choice at all, so do not ask. Ticked, so a
        // failure lands on the picker ready to try again.
        if (organizations.length === 1 && !autoContinued.current) {
          autoContinued.current = true;
          setChosen(new Set([organizations[0].slug]));
          onContinue(organizations);
        }
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : String(err));
        setOptions([]);
      });
    // Only on arrival: a new `onContinue` must not re-run the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootUrl, onError]);

  const toggle = (slug: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const hasOptions = (options?.length ?? 0) > 0;

  if (autoContinued.current && busy) {
    return (
      <section className="onboarding">
        <Logo />
        <h2>Almost ready</h2>
        <p className="muted">Opening your account…</p>
        {footer}
      </section>
    );
  }

  return (
    <section className="onboarding">
      <Logo />
      <h2>Which organizations should work offline?</h2>
      <p className="muted">
        We&apos;ll copy them to this computer in the background and keep them in
        sync. You can start working online right away.
      </p>

      {options === null && <p className="muted">Loading…</p>}

      {options?.length === 0 && (
        <p className="muted">
          This account has no organizations yet. You can add one later in
          Settings.
        </p>
      )}

      {hasOptions && (
        <div
          className="choices ui--option-group"
          role="group"
          aria-label="Organizations"
        >
          {options!.map((org) => (
            <Option
              key={org.slug}
              title={org.name}
              description={
                org.connected ? "Already on this computer" : undefined
              }
              selected={chosen.has(org.slug)}
              disabled={busy}
              onClick={() => toggle(org.slug)}
            />
          ))}
        </div>
      )}

      <Button
        className="onboarding-primary"
        isLoading={busy}
        disabled={busy || options === null || (hasOptions && chosen.size === 0)}
        onClick={() =>
          onContinue((options ?? []).filter((org) => chosen.has(org.slug)))
        }
      >
        {busy ? "Opening…" : "Continue"}
      </Button>

      {footer}
    </section>
  );
}
