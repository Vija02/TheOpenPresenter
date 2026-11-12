import { spawn } from "child_process";
import { closeSync, constants, existsSync, openSync, readSync } from "fs";
import { readFile } from "fs/promises";

import { RuntimeClient } from "../runtime/client";

/** Linux input devices, read straight from /dev/input. */

export type ClickerKey = "PREV" | "NEXT";

/** One /dev/input/eventN node. A clicker often has several. */
export type InputNode = {
  vendor: string;
  product: string;
  name: string;
  path: string;
};

/** A physical device: every node sharing its USB/Bluetooth ids. */
export type InputDevice = { id: string; name: string; paths: string[] };

const EV_KEY = 1;
const INPUT_EVENT_SIZE = 24; // struct input_event on 64-bit Linux

const KEYS: Record<number, ClickerKey> = {
  103: "PREV", // KEY_UP
  104: "PREV", // KEY_PAGEUP
  105: "PREV", // KEY_LEFT
  106: "NEXT", // KEY_RIGHT
  108: "NEXT", // KEY_DOWN
  109: "NEXT", // KEY_PAGEDOWN
};

export const keyFor = (code: number): ClickerKey | null => KEYS[code] ?? null;

/** KEY_Q..P, KEY_A..L and KEY_Z..M: what typing on a keyboard sends. */
export const isLetter = (code: number): boolean =>
  (code >= 16 && code <= 25) ||
  (code >= 30 && code <= 38) ||
  (code >= 44 && code <= 50);

/** Keyboard-like nodes in /proc/bus/input/devices: clickers present as keyboards. */
export function parseInputDevices(text: string): InputNode[] {
  const nodes: InputNode[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const ids = block.match(/^I: .*Vendor=([0-9a-f]+) Product=([0-9a-f]+)/m);
    const name = block.match(/^N: Name="(.*)"$/m)?.[1] ?? "";
    const handlers = block.match(/^H: Handlers=(.*)$/m)?.[1]?.split(/\s+/);
    if (!ids || !handlers?.includes("kbd")) continue;
    for (const h of handlers) {
      if (!/^event\d+$/.test(h)) continue;
      nodes.push({
        vendor: ids[1]!,
        product: ids[2]!,
        name,
        path: `/dev/input/${h}`,
      });
    }
  }
  return nodes;
}

/** Nodes without real ids (built-in, virtual) are told apart by name. */
export const deviceId = (n: Pick<InputNode, "vendor" | "product" | "name">) =>
  n.vendor === "0000" && n.product === "0000"
    ? `name:${n.name}`
    : `${n.vendor}:${n.product}`;

export function groupDevices(nodes: InputNode[]): InputDevice[] {
  const byId = new Map<string, InputDevice>();
  for (const n of nodes) {
    const id = deviceId(n);
    const d = byId.get(id);
    if (!d) byId.set(id, { id, name: n.name, paths: [n.path] });
    else {
      d.paths.push(n.path);
      // "Presenter" reads better than "Presenter Consumer Control".
      if (n.name.length < d.name.length) d.name = n.name;
    }
  }
  return [...byId.values()];
}

export async function listInputDevices(): Promise<InputDevice[]> {
  try {
    return groupDevices(
      parseInputDevices(await readFile("/proc/bus/input/devices", "utf8")),
    );
  } catch {
    return [];
  }
}

// -- Exclusive grab, so presses don't also reach the focused window ------------

/** Whether grabbing can work at all: the sidecar that does it is there. */
export const canGrab = (): boolean => existsSync(RuntimeClient.binaryPath());

/**
 * The runtime manager sidecar does the EVIOCGRAB on our fd, passed as its
 * fd 3, and exits. The grab belongs to the open device, so it lasts until we
 * close it; Node can't make the ioctl itself. In the background, so the main
 * process never waits on it.
 */
function grab(fd: number): Promise<string | null> {
  return new Promise((resolve) => {
    let stderr = "";
    const child = spawn(RuntimeClient.binaryPath(), ["grab-input"], {
      stdio: ["ignore", "ignore", "pipe", fd],
      timeout: 5000,
    });
    child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (err) => resolve(err.message));
    child.on("close", (code) =>
      resolve(code === 0 ? null : stderr.trim() || `exited with ${code}`),
    );
  });
}

// -- Reading -------------------------------------------------------------------

const POLL_MS = 15;
const buf = Buffer.alloc(INPUT_EVENT_SIZE * 64);

/** Drains its node; false once the node is gone. */
type Poll = () => boolean;

// One timer for every open node, running only while any is open.
const polls = new Set<Poll>();
let pollTimer: NodeJS.Timeout | null = null;

function poll(): void {
  for (const p of polls) if (!p()) polls.delete(p);
  if (polls.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** An open node. `close` releases it, and its grab, without calling onClose. */
export type InputReader = {
  close: () => void;
  /** Take it for ourselves: null once taken, or why not. */
  grab: () => Promise<string | null>;
};

export type OpenResult =
  | { ok: true; reader: InputReader }
  | { ok: false; denied: boolean };

/**
 * Read key presses from one node until it is unplugged or closed. Non-blocking
 * and polled: a blocking read would hold one of libuv's four pool threads per
 * node, and a few nodes would stall every other file read in the app.
 */
export function openNode(
  path: string,
  onKey: (code: number) => void,
  onClose: () => void,
): OpenResult {
  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return { ok: false, denied: code === "EACCES" || code === "EPERM" };
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    polls.delete(drain);
    try {
      closeSync(fd);
    } catch {
      // Already gone with the device.
    }
  };

  const drain: Poll = () => {
    // evdev only ever returns whole events.
    for (;;) {
      if (closed) return false;
      let n: number;
      try {
        n = readSync(fd, buf, 0, buf.length, null);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EAGAIN") return true;
        // ENODEV: unplugged.
        close();
        onClose();
        return false;
      }
      for (let at = 0; at + INPUT_EVENT_SIZE <= n; at += INPUT_EVENT_SIZE) {
        const type = buf.readUInt16LE(at + 16);
        const code = buf.readUInt16LE(at + 18);
        const value = buf.readInt32LE(at + 20);
        // 1 is a press; 0 release and 2 autorepeat are ignored.
        if (type === EV_KEY && value === 1) onKey(code);
      }
      if (n < buf.length) return true;
    }
  };

  polls.add(drain);
  pollTimer ??= setInterval(poll, POLL_MS);
  return {
    ok: true,
    reader: {
      close,
      // The child gets its own copy of the fd as it starts, so a close
      // after that can't hand it a reused number.
      grab: () => (closed ? Promise.resolve("closed") : grab(fd)),
    },
  };
}
