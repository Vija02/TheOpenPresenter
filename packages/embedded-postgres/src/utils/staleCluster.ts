import { existsSync } from "fs";
import { readFile, rm } from "fs/promises";
import { Socket } from "net";
import { join } from "path";

/** How long an orphaned cluster gets to shut down cleanly before we force it. */
const ORPHAN_SHUTDOWN_TIMEOUT_MS = 15_000;
/** How long we wait after SIGKILL before giving up and starting anyway. */
const ORPHAN_KILL_TIMEOUT_MS = 5_000;
/** How long to wait when probing whether the port is occupied. */
const PORT_PROBE_TIMEOUT_MS = 1_000;

export interface StaleClusterOptions {
  databaseDir: string;
  port: number;
}

interface PostmasterInfo {
  pid: number;
  port: number | null;
}

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const getPostmasterPidPath = (databaseDir: string): string =>
  join(databaseDir, "postmaster.pid");

export const readPostmasterPid = async (
  databaseDir: string,
): Promise<PostmasterInfo | null> => {
  const pidPath = getPostmasterPidPath(databaseDir);
  if (!existsSync(pidPath)) {
    return null;
  }

  try {
    const lines = (await readFile(pidPath, "utf8")).split("\n");
    const pid = Number.parseInt(lines[0] ?? "", 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      return null;
    }
    const port = Number.parseInt(lines[3] ?? "", 10);
    return { pid, port: Number.isInteger(port) ? port : null };
  } catch (err) {
    console.warn("Failed to read postmaster.pid:", err);
    return null;
  }
};

/** Signal 0 delivers nothing; it only probes whether the pid exists. */
const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means it exists but belongs to another user, so it is alive.
    return (err as NodeJS.ErrnoException)?.code === "EPERM";
  }
};

const isPortInUse = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new Socket();
    const finish = (inUse: boolean) => {
      socket.destroy();
      resolve(inUse);
    };

    socket.setTimeout(PORT_PROBE_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });

const signalProcess = (pid: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(pid, signal);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ESRCH") {
      return true; // Already gone.
    }
    console.warn(`Failed to send ${signal} to pid ${pid}:`, err);
    return false;
  }
};

const waitForExit = async (
  pid: number,
  timeoutMs: number,
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await delay(200);
  }
  return !isProcessAlive(pid);
};

const stopOrphan = async (pid: number, databaseDir: string): Promise<void> => {
  // SIGINT is PostgreSQL's "fast shutdown": abort open transactions and exit.
  // SIGTERM would be a "smart shutdown", which waits for existing clients to
  // disconnect — and the orphan may still have the previous app's connections
  // attached, so that could hang indefinitely.
  //
  // On Windows, Node ignores the signal name and terminates the process
  // outright. That's an unclean stop, but the cluster replays WAL on next
  // start, which is the same recovery path as the crash we're cleaning up after.
  if (signalProcess(pid, "SIGINT")) {
    if (await waitForExit(pid, ORPHAN_SHUTDOWN_TIMEOUT_MS)) {
      console.log("Orphaned PostgreSQL stopped");
    } else {
      console.warn(
        `Orphaned PostgreSQL (pid ${pid}) did not stop within ${ORPHAN_SHUTDOWN_TIMEOUT_MS}ms; forcing it`,
      );
      signalProcess(pid, "SIGKILL");
      await waitForExit(pid, ORPHAN_KILL_TIMEOUT_MS);
    }
  }

  // However it went, the pid file no longer describes a live cluster.
  await rm(getPostmasterPidPath(databaseDir), { force: true });
};

/**
 * If a previous run was killed before it could stop PostgreSQL (app crash,
 * SIGKILL, power loss), the cluster is still running and still holding the
 * port, so our next start() fails. Detect that on startup and clear it.
 *
 * Only ever signals when a live pid AND an occupied port coincide: a pid that
 * is alive while the port is free means the pid was recycled by an unrelated
 * process, and killing it would be destructive.
 */
export const reconcileStaleCluster = async ({
  databaseDir,
  port,
}: StaleClusterOptions): Promise<void> => {
  if (!existsSync(databaseDir)) {
    return;
  }

  const info = await readPostmasterPid(databaseDir);
  if (!info) {
    return;
  }

  const pidPath = getPostmasterPidPath(databaseDir);

  if (!isProcessAlive(info.pid)) {
    // PostgreSQL usually clears this itself, but if the pid has since been
    // reused by an unrelated process it refuses to start instead. The process
    // it names is gone, so the file carries no information.
    console.warn(
      `Removing stale postmaster.pid (pid ${info.pid} is no longer running)`,
    );
    await rm(pidPath, { force: true });
    return;
  }

  const clusterPort = info.port ?? port;
  if (!(await isPortInUse(clusterPort))) {
    console.warn(
      `postmaster.pid names pid ${info.pid}, but nothing is listening on port ${clusterPort}; treating the pid as recycled and removing the file`,
    );
    await rm(pidPath, { force: true });
    return;
  }

  console.warn(
    `Found an orphaned PostgreSQL (pid ${info.pid}) still holding port ${clusterPort}; stopping it before we start`,
  );
  await stopOrphan(info.pid, databaseDir);
};
