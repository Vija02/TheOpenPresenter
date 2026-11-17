import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { type AddressInfo, createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Another computer to join: the real `top-studio-helper` sharing a tiny web
 * server, as a Studio would share its own. No runtime and no database.
 *
 * The helper finds the server through `runtime.lock`, which normally the
 * runtime manager writes. This writes it instead, owned by the test process
 * so the helper sees a live manager.
 */

const STUDIO_DIR = join(__dirname, "../../native-apps/studio");
const BINARY =
  process.platform === "win32" ? "top-studio-helper.exe" : "top-studio-helper";

function helperBinary(): string {
  const candidates = [
    join(STUDIO_DIR, "resources", BINARY),
    join(STUDIO_DIR, "../studio-helper/target/release", BINARY),
    join(STUDIO_DIR, "../studio-helper/target/debug", BINARY),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `No ${BINARY} to share with. Build native-apps/studio-helper first.`,
    );
  }
  return found;
}

/** A port nothing is listening on right now. */
export async function freePort(): Promise<number> {
  const server = createTcpServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export type JoinHost = {
  name: string;
  /** Endpoint ID: stays the same across restarts, like a real install. */
  id: string;
  /** Pasted into "Another computer or server". */
  ticket: string;
  share: () => Promise<void>;
  stopSharing: () => Promise<void>;
  /** The helper process dies with no goodbye, as on a power cut. */
  kill: () => void;
  /** A new helper process on the same data folder, sharing again. */
  restart: () => Promise<void>;
  close: () => Promise<void>;
};

export async function startJoinHost(name: string): Promise<JoinHost> {
  const root = mkdtempSync(join(tmpdir(), "top-e2e-host-"));

  // Every path answers, so the app's entry URL and any page path load.
  const server: Server = createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(
      `<!doctype html><title>${name}</title><h1 id="host-page">${name} ${req.url}</h1>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const httpPort = (server.address() as AddressInfo).port;

  writeFileSync(
    join(root, "runtime.lock"),
    JSON.stringify({
      manager_pid: process.pid,
      http_port: httpPort,
      holders: [],
    }),
  );

  let child: ChildProcessWithoutNullStreams;
  let nextId = 1;
  let buffer = "";
  const waiting = new Map<number, (reply: Record<string, unknown>) => void>();

  const spawnHelper = () => {
    child = spawn(helperBinary(), ["--root", root], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const message = JSON.parse(line) as Record<string, unknown>;
        const resolve = waiting.get(message.id as number);
        if (resolve) {
          waiting.delete(message.id as number);
          resolve(message);
        }
      }
    });
    // Its log is noise here, but must be read or the pipe fills.
    child.stderr.resume();
    child.stdin.on("error", () => undefined);
  };

  const request = (command: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(
        () => reject(new Error(`Host helper didn't answer ${command.cmd}`)),
        30_000,
      );
      waiting.set(id, (reply) => {
        clearTimeout(timer);
        if (reply.ok) resolve(reply.result as Record<string, unknown>);
        else reject(new Error(String(reply.error)));
      });
      child.stdin.write(`${JSON.stringify({ id, ...command })}\n`);
    });

  const share = async () => {
    const status = await request({ cmd: "remote_start", name });
    return status as { node_id: string; ticket: string };
  };

  spawnHelper();
  const first = await share();

  return {
    name,
    id: first.node_id,
    ticket: first.ticket,
    share: async () => {
      await share();
    },
    stopSharing: async () => {
      await request({ cmd: "remote_stop" });
    },
    kill: () => {
      child.kill("SIGKILL");
    },
    restart: async () => {
      spawnHelper();
      await share();
    },
    close: async () => {
      await request({ cmd: "shutdown" }).catch(() => undefined);
      child.kill();
      await new Promise((resolve) => server.close(resolve));
      rmSync(root, { recursive: true, force: true });
    },
  };
}
