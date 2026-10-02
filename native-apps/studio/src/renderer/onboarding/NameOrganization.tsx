import { Button, Input } from "@repo/ui";
import { useState } from "react";

import { api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";

/**
 * Name the organisation, for someone not connecting to a server. They still
 * need somewhere for their projects to live, and "Local" is an implementation
 * detail rather than a name anyone chose.
 */
export function NameOrganization({
  onCreated,
  onError,
}: {
  onCreated: (organizationSlug?: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      const organization = await api.createLocalOrganization(trimmed);
      onCreated(organization.slug);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <section className="onboarding">
      <Logo />
      <h2>What is your church or venue called?</h2>
      <p className="muted">
        This is the name your projects are filed under. You can change it later.
      </p>

      <form onSubmit={submit} className="name-form">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="St Mary's Chapel"
          autoFocus
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? "Setting up…" : "Continue"}
        </Button>
      </form>
    </section>
  );
}
