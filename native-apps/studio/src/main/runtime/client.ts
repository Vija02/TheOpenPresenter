import { type ChildProcessWithoutNullStreams, spawn } from "child_process";
import { app } from "electron";
import { EventEmitter } from "events";
import { existsSync } from "fs";
import { join } from "path";

import { runtimeRoot } from "../settings/paths";

/** Peer-to-peer remote access state. */
export type RemoteStatus = {
  enabled: boolean;
  ticket: string | null;
  node_id: string | null;
  /** Absent on a build without remote support. */
  supported?: boolean;
};

export type RuntimeStatus = {
  root: string;
  installed: string[];
  current: string | null;
  lastGood: string | null;
  migratedSchemaVersion: number;
  crashCount: number;
  running: boolean;
};

export type ProgressEvent = {
  phase: string;
  done: number;
  total: number;
  bytes?: number;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

/** How long a single command may take before we stop waiting for it. */
const REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

const HOLDER = "desktop-shell";

export class RuntimeClient extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private buffer = "";
  private localUrl: string | null = null;
  /** In-flight start, so concurrent callers share one attempt. */
  private starting: Promise<{
    url: string;
    httpPort: number;
    version: string;
  }> | null = null;
  /** Recent stderr, kept so an early exit can explain itself. */
  private stderrTail: string[] = [];

  /** URL the local runtime is serving on, once it has reported one. */
  get url(): string | null {
    return this.localUrl;
  }

  get isRunning(): boolean {
    return this.child !== null;
  }

  /** Locate the sidecar binary. */
  static binaryPath(): string {
    const name =
      process.platform === "win32"
        ? "top-runtime-manager.exe"
        : "top-runtime-manager";

    const candidates = app.isPackaged
      ? [join(process.resourcesPath, name)]
      : [
          // Same location the packaged app uses, populated by
          // scripts/prepare-sidecar.cjs, so dev and production match.
          join(__dirname, "../../resources", name),
          join(__dirname, "../../../runtime-manager/target/release", name),
          join(__dirname, "../../../runtime-manager/target/debug", name),
        ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    return candidates[0]!;
  }

  start(options: { source?: string; root?: string } = {}): void {
    if (this.child) return;

    const binary = RuntimeClient.binaryPath();
    if (!existsSync(binary)) {
      throw new Error(
        `Runtime manager not found at ${binary}. Build it with ` +
          `\`cargo build --release\` in native-apps/runtime-manager, or ` +
          `reinstall the app.`,
      );
    }

    const args: string[] = [];

    args.push("--root", options.root ?? runtimeRoot());
    if (options.source) args.push("--source", options.source);

    const child = spawn(binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        TOP_NODE_BINARY: process.execPath,
      },
    });
    this.child = child;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onData(chunk));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;
        console.log("[runtime-manager]", line);
        // The manager validates its signing key before reading a single
        // command, and that failure is otherwise invisible.
        this.stderrTail.push(line);
        if (this.stderrTail.length > 20) this.stderrTail.shift();
      }
    });

    child.on("exit", (code) => {
      this.child = null;
      this.localUrl = null;
      const detail = this.stderrTail.join("\n").trim();
      const message =
        `Runtime manager exited (code ${code})` +
        (detail ? `:\n${detail}` : "");
      // Leaving them pending would hang the settings UI on a spinner.
      for (const [, pending] of this.pending) {
        pending.reject(new Error(message));
      }
      this.pending.clear();
      this.emit("manager-exit", { code, detail });
    });

    child.on("error", (err) => {
      console.error("[runtime-manager] failed to start:", err);
      this.emit("manager-error", err);
    });
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
        console.warn("[runtime-manager] unparseable line:", line);
        continue;
      }

      const id = message.id;
      if (typeof id === "number") {
        const pending = this.pending.get(id);
        if (!pending) continue;
        this.pending.delete(id);
        if (message.ok) pending.resolve(message.result);
        else
          pending.reject(new Error(String(message.error ?? "unknown error")));
        continue;
      }

      this.onEvent(message);
    }
  }

  private onEvent(message: Record<string, unknown>): void {
    switch (message.event) {
      case "progress":
        this.emit("progress", {
          phase: String(message.phase),
          done: Number(message.done ?? 0),
          total: Number(message.total ?? 0),
          bytes: message.bytes == null ? undefined : Number(message.bytes),
        } satisfies ProgressEvent);
        break;
      case "ready":
        this.emit("ready", message);
        break;
      case "listening":
        this.localUrl = String(message.url);
        this.emit("listening", { url: this.localUrl, port: message.port });
        break;
      case "log":
        // Forward just the text: passing the `{ stream, line }` envelope means
        // anything that stringifies it prints "[object Object]".
        this.emit("log", String(message.line ?? ""));
        break;
      case "exited":
        this.localUrl = null;
        this.emit("runtime-exit", message);
        break;
      default:
        break;
    }
  }

  private request<T>(command: Record<string, unknown>): Promise<T> {
    const child = this.child;
    if (!child) {
      return Promise.reject(new Error("Runtime manager is not running"));
    }

    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Runtime command timed out: ${command.cmd}`));
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

  status(): Promise<RuntimeStatus> {
    return this.request<RuntimeStatus>({ cmd: "status" });
  }

  check(channel: string): Promise<{ channel: string; version: string }> {
    return this.request({ cmd: "check", channel });
  }

  /** Download and ensure we have a runtime. */
  ensure(
    channel: string,
    activate = true,
  ): Promise<{ version: string; root: string; activated: boolean }> {
    return this.request({ cmd: "ensure", channel, activate });
  }

  /** Switch to an installed version. Takes effect on the next start. */
  activate(version: string): Promise<{ version: string }> {
    return this.request({ cmd: "activate", version });
  }

  /** Where runtimes, data and logs live, as the manager sees them. */
  paths(): Promise<{
    root: string;
    versions: string;
    data: string;
    cache: string;
    logs: string;
  }> {
    return this.request({ cmd: "paths" });
  }

  /** Start the runtime, or adopt one that is already up. */
  async startRuntime(): Promise<{
    url: string;
    httpPort: number;
    version: string;
  }> {
    if (this.starting) return this.starting;

    this.starting = (async () => {
      try {
        const result = await this.request<{
          url: string;
          httpPort: number;
          version: string;
        }>({ cmd: "start", holder: HOLDER });

        // A runtime that was already serving is adopted rather than spawned,
        // so it never emits `listening` to this process. Recording the URL
        // the manager reports is the only way `runtime.url` gets set in that
        // case, and without it startup navigates to an empty string and sits
        // on "Starting up" forever.
        if (result?.url) this.localUrl = String(result.url);
        return result;
      } catch (err) {
        // Already serving is the outcome the caller wanted.
        if (!/already running/i.test(String(err))) throw err;

        const status = await this.status();
        const url = this.localUrl ?? "";
        return {
          url,
          httpPort: url ? Number(new URL(url).port || 80) : 0,
          version: status.current ?? "",
        };
      }
    })().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  stopRuntime(force = false): Promise<unknown> {
    return this.request({ cmd: "stop", holder: HOLDER, force });
  }

  prune(keep: string[]): Promise<{ freedBytes: number }> {
    return this.request({ cmd: "prune", keep });
  }

  async shutdown(): Promise<void> {
    if (!this.child) return;
    try {
      await this.request({ cmd: "shutdown" });
    } catch {
      // The manager may have exited already; killing below covers it.
    }
    this.child?.kill();
    this.child = null;
  }

  /** Peer-to-peer iroh access to the running server. */
  remoteStatus(): Promise<RemoteStatus> {
    return this.request<RemoteStatus>({ cmd: "remote_status" });
  }

  startRemote(): Promise<RemoteStatus> {
    return this.request<RemoteStatus>({ cmd: "remote_start" });
  }

  stopRemote(): Promise<RemoteStatus> {
    return this.request<RemoteStatus>({ cmd: "remote_stop" });
  }
}

export const runtime = new RuntimeClient();
