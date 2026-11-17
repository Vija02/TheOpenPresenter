import { Alert, Button, Input, Option } from "@repo/ui";
import { type ReactNode, useEffect, useState } from "react";

import {
  type ConnectionSummary,
  type DiscoveredHost,
  type DiscoveryEvent,
  api,
  listen,
} from "../bridge/ipc";

/** A computer's code (a ticket) or bare ID, rather than a server address. */
export const isJoinCode = (text: string): boolean =>
  /^endpoint[a-z2-7]+$/i.test(text.trim()) ||
  /^[0-9a-f]{64}$/i.test(text.trim());

/**
 * Computers sharing on this network, plus pasting a code for one that isn't.
 * Picking one joins it and switches the app to it.
 */
export function ComputerPicker({
  onJoined,
  allowPaste = true,
  quiet = false,
  heading,
}: {
  onJoined?: (summary: ConnectionSummary) => void;
  /** Off where another field already takes a code. */
  allowPaste?: boolean;
  /** Nothing at all until a computer is found, and small rows when one is. */
  quiet?: boolean;
  heading?: ReactNode;
}) {
  const [hosts, setHosts] = useState<DiscoveredHost[]>([]);
  const [joining, setJoining] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const upsert = (host: DiscoveredHost) =>
      setHosts((list) => [...list.filter((h) => h.id !== host.id), host]);
    const off = listen<DiscoveryEvent>("join:discovery", (event) => {
      if (event.event === "host_discovered") upsert(event.host);
      else setHosts((list) => list.filter((h) => h.id !== event.id));
    });
    api
      .discoverHosts()
      .then((found) => found.forEach(upsert))
      .catch(() => setProblem("Couldn't look for computers on this network."));
    return () => {
      off();
      void api.stopDiscovery().catch(() => undefined);
    };
  }, []);

  const join = async (peer: string, host?: DiscoveredHost) => {
    setProblem(null);
    setJoining(peer);
    try {
      const summary = await api.joinHost(peer, host?.port, host?.name);
      onJoined?.(summary);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setJoining(null);
    }
  };

  const sorted = [...hosts].sort((a, b) => a.name.localeCompare(b.name));
  const pasted = code.trim();

  if (quiet && sorted.length === 0) return null;

  return (
    <>
      {heading}
      {problem && (
        <Alert variant="destructive" size="sm" title="Couldn't join">
          {problem}
        </Alert>
      )}

      <div className="choices">
        {sorted.map((host) => (
          <Option
            key={host.id}
            title={host.name}
            size={quiet ? "sm" : undefined}
            description={joining === host.id ? "Joining…" : undefined}
            selected={joining === host.id}
            disabled={joining !== null}
            onClick={() => void join(host.id, host)}
          />
        ))}
        {sorted.length === 0 && !quiet && (
          <p className="muted">Looking for computers on this network…</p>
        )}
      </div>

      {!allowPaste ? null : pasting ? (
        <label className="field">
          <span>Code from the other computer</span>
          <Input
            autoFocus
            value={code}
            disabled={joining !== null}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) =>
              event.key === "Enter" && pasted && void join(pasted)
            }
          />
          <Button
            className="onboarding-primary"
            disabled={!pasted || joining !== null}
            onClick={() => void join(pasted)}
          >
            {joining === pasted ? "Joining…" : "Join"}
          </Button>
        </label>
      ) : (
        <Button variant="link" size="xs" onClick={() => setPasting(true)}>
          Not listed? Paste its code
        </Button>
      )}
    </>
  );
}
