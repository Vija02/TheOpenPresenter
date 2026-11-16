import { type ChildProcessWithoutNullStreams, spawn } from "child_process";
import { app } from "electron";
import { EventEmitter } from "events";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { runtimeRoot } from "../settings/paths";
import { logShell } from "../shell/log";

/** Peer-to-peer remote access state. */
export type RemoteStatus = {
  enabled: boolean;
  ticket: string | null;
  node_id: string | null;
  /** False when this install has no helper, so the settings panel hides. */
  supported?: boolean;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const OFF: RemoteStatus = { enabled: false, ticket: null, node_id: null };

/** Starting a tunnel waits up to 10s for a relay; leave room for that. */
const REQUEST_TIMEOUT_MS = 60 * 1000;

/**
 * The `top-studio-helper` sidecar: native pieces Electron can't do by itself, such
 * as peer-to-peer remote access over iroh and grabbing input devices.
 *
 * Unlike the runtime manager it is started on first use, not at launch, so a
 * Studio that never turns on remote access never runs it.
 */
export class HelperClient extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private buffer = "";
  /** Set by `shutdown`, so an exit we asked for is not mistaken for a crash. */
  private stopping = false;

  get isRunning(): boolean {
    return this.child !== null;
  }

  /** Locate the sidecar binary. */
  static binaryPath(): string {
    const name =
      process.platform === "win32"
        ? "top-studio-helper.exe"
        : "top-studio-helper";

    const candidates = app.isPackaged
      ? [join(process.resourcesPath, name)]
      : [
          // Populated by scripts/prepare-sidecar.cjs, like the manager.
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

    // Same root as the runtime manager: the helper reads the server's port
    // and keeps the iroh identity there.
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

    // A helper that dies mid-write would otherwise surface as an unhandled
    // EPIPE in the main process. The exit handler deals with the death.
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

  /** Forget a dead helper and fail whatever was waiting on it. */
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

  /**
   * Remote access state. Asks the helper when it's running; otherwise reads
   * the lock file, which still shows a tunnel that another app sharing this
   * runtime opened, without starting a helper just to look.
   */
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

  /** Nothing to stop when the helper isn't running: its tunnel died with it. */
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
      // It may have exited already; killing below covers it.
    }
    child.kill();
    if (this.child === child) this.child = null;
  }
}

/**
 * The tunnel recorded in `<root>/runtime.lock`, if its owner is still alive.
 * Written by `top-studio-helper`; see `storage/lock.rs` in the runtime manager.
 */
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
