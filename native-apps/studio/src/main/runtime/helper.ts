import { type ChildProcessWithoutNullStreams, spawn } from "child_process";
import { app } from "electron";
import { EventEmitter } from "events";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { runtimeRoot } from "../settings/paths";
import { logShell } from "../shell/log";

export type JoinedHost = {
  peer: string;
  name: string | null;
  local_url: string;
  /** False between a drop and the next request, which dials again. */
  connected: boolean;
};

/** A Studio hosting on the local network. */
export type DiscoveredHost = {
  id: string;
  name: string;
  /** Its server port, to join on the same one. */
  port: number | null;
};

export type DiscoveryEvent =
  | { event: "host_discovered"; host: DiscoveredHost }
  | { event: "host_expired"; id: string };

export type RemoteStatus = {
  /** Whether this install is hosting. */
  enabled: boolean;
  ticket: string | null;
  node_id: string | null;
  /** False when there's no helper binary; hides the settings panel. */
  supported?: boolean;
  client?: JoinedHost | null;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const OFF: RemoteStatus = { enabled: false, ticket: null, node_id: null };

/** Starting a tunnel waits up to 10s for a relay; leave room for that. */
const REQUEST_TIMEOUT_MS = 60 * 1000;

/** The `top-studio-helper` sidecar. Started on first use, not at launch. */
export class HelperClient extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private buffer = "";
  /** So an exit we asked for isn't treated as a crash. */
  private stopping = false;
  /** Callers of `discoverStart` that haven't stopped yet. */
  private browsing = 0;

  get isRunning(): boolean {
    return this.child !== null;
  }

  static binaryPath(): string {
    const name =
      process.platform === "win32"
        ? "top-studio-helper.exe"
        : "top-studio-helper";

    const candidates = app.isPackaged
      ? [join(process.resourcesPath, name)]
      : [
          // Staged by scripts/prepare-sidecar.cjs.
          join(__dirname, "../../resources", name),
          join(__dirname, "../../../studio-helper/target/release", name),
          join(__dirname, "../../../studio-helper/target/debug", name),
        ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    return candidates[0]!;
  }

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child;
    this.stopping = false;

    const binary = HelperClient.binaryPath();
    if (!existsSync(binary)) {
      throw new Error(
        `Helper not found at ${binary}. Build it with \`cargo build\` in ` +
          `native-apps/studio-helper, or reinstall the app.`,
      );
    }

    // Must match the runtime manager's root.
    const child = spawn(binary, ["--root", runtimeRoot()], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.buffer = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onData(chunk));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split("\n")) {
        if (line.trim()) logShell("info", "[helper]", line);
      }
    });

    // Otherwise a helper dying mid-write is an unhandled EPIPE.
    child.stdin.on("error", (err) => {
      logShell("warn", "[helper] stdin:", err);
    });

    child.on("exit", (code) => {
      this.onGone(child, `Helper exited (code ${code})`, { code });
    });

    // Fired instead of "exit" when the binary can't be started at all.
    child.on("error", (err) => {
      logShell("error", "[helper] failed to start:", err);
      this.onGone(child, `Helper failed to start: ${err.message}`, {
        code: null,
      });
    });

    return child;
  }

  private onGone(
    child: ChildProcessWithoutNullStreams,
    message: string,
    detail: { code: number | null },
  ): void {
    if (this.child !== child) return;
    this.child = null;
    for (const [, pending] of this.pending) {
      pending.reject(new Error(message));
    }
    this.pending.clear();
    if (!this.stopping) {
      logShell("error", `[helper] ${message}`);
      this.emit("unexpected-exit", detail);
    }
  }

  private onData(chunk: string): void {
    this.buffer += chunk;

    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;

      let message: Record<string, unknown>;
      try {
        message = JSON.parse(line) as Record<string, unknown>;
      } catch {
        logShell("warn", "[helper] unparseable line:", line);
        continue;
      }

      if (message.event === "tunnel_closed") {
        this.emit("tunnel-closed", message.peer);
        continue;
      }
      if (typeof message.event === "string") {
        this.emit("discovery", message as DiscoveryEvent);
        continue;
      }

      const id = message.id;
      if (typeof id !== "number") continue;
      const pending = this.pending.get(id);
      if (!pending) continue;
      this.pending.delete(id);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error(String(message.error ?? "unknown error")));
    }
  }

  private request<T>(command: Record<string, unknown>): Promise<T> {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.ensureStarted();
    } catch (err) {
      return Promise.reject(err);
    }

    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Helper command timed out: ${command.cmd}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      child.stdin.write(`${JSON.stringify({ id, ...command })}\n`);
    });
  }

  /** Reads the lock file when the helper isn't running, rather than start it. */
  remoteStatus(): Promise<RemoteStatus> {
    if (this.child) {
      return this.request<RemoteStatus>({ cmd: "remote_status" });
    }
    if (!existsSync(HelperClient.binaryPath())) {
      return Promise.resolve({ ...OFF, supported: false });
    }
    return Promise.resolve(remoteFromLock() ?? OFF);
  }

  startRemote(): Promise<RemoteStatus> {
    return this.request<RemoteStatus>({ cmd: "remote_start" });
  }

  /** `peer` is a ticket or endpoint ID; `port` is preferred if free. */
  connectRemote(peer: string, port?: number): Promise<JoinedHost> {
    return this.request<JoinedHost>({ cmd: "remote_connect", peer, port });
  }

  async disconnectRemote(): Promise<RemoteStatus> {
    if (!this.child) return OFF;
    return this.request<RemoteStatus>({ cmd: "remote_disconnect" });
  }

  /**
   * Lists hosts known so far; `discovery` events follow. Counted: the helper
   * has one browser, and it runs until every caller has stopped.
   */
  async discoverStart(): Promise<DiscoveredHost[]> {
    this.browsing++;
    const result = await this.request<{ hosts: DiscoveredHost[] }>({
      cmd: "discover_start",
    });
    return result.hosts;
  }

  async discoverStop(): Promise<void> {
    this.browsing = Math.max(0, this.browsing - 1);
    if (this.browsing > 0 || !this.child) return;
    await this.request({ cmd: "discover_stop" });
  }

  /** A helper that isn't running has no tunnel. */
  async stopRemote(): Promise<RemoteStatus> {
    if (!this.child) return OFF;
    return this.request<RemoteStatus>({ cmd: "remote_stop" });
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    const child = this.child;
    if (!child) return;
    try {
      await this.request({ cmd: "shutdown" });
    } catch {
      // Killed below either way.
    }
    child.kill();
    if (this.child === child) this.child = null;
  }
}

/** Mirrors `storage/lock.rs` in the runtime manager. */
function remoteFromLock(): RemoteStatus | null {
  let lock: {
    remote?: { ticket?: unknown; node_id?: unknown; owner_pid?: unknown };
  };
  try {
    lock = JSON.parse(
      readFileSync(join(runtimeRoot(), "runtime.lock"), "utf8"),
    );
  } catch {
    return null;
  }

  const remote = lock.remote;
  if (
    !remote ||
    typeof remote.ticket !== "string" ||
    typeof remote.node_id !== "string" ||
    typeof remote.owner_pid !== "number" ||
    !processAlive(remote.owner_pid)
  ) {
    return null;
  }
  return { enabled: true, ticket: remote.ticket, node_id: remote.node_id };
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: it exists, we just may not signal it.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export const helper = new HelperClient();
