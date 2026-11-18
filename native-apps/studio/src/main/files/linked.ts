import { type IpcMainEvent, type IpcMainInvokeEvent, ipcMain } from "electron";
import {
  type FSWatcher,
  mkdirSync,
  readFileSync,
  watch,
  writeFileSync,
} from "fs";
import { readFile } from "fs/promises";
import { basename, dirname, join } from "path";

import { helper } from "../runtime/helper";
import { shellDir } from "../settings/paths";
import { computerAt } from "../settings/store";
import { logShell } from "../shell/log";

/**
 * Slides linked to a file on this computer while the server is another one
 * (a joined computer). This computer watches the file; the page re-uploads it.
 */

const SETTLE_MS = 3000;
const MAX_ALLOWED = 200;

type Sender = IpcMainEvent["sender"];

/** A file the user picked, and the server it was linked on */
type AllowedFile = {
  /** A joined computer's peer, else the page's origin */
  host: string;
  path: string;
};

// Its own file, not settings.json: it outlives restarts, as links do, and
// people edit settings.json by hand
const allowedFilesPath = () => join(shellDir(), "linked-files.json");

const loadAllowed = (): AllowedFile[] => {
  try {
    const list: unknown = JSON.parse(readFileSync(allowedFilesPath(), "utf8"));
    return Array.isArray(list)
      ? list.filter(
          (f): f is AllowedFile =>
            typeof f?.host === "string" && typeof f?.path === "string",
        )
      : [];
  } catch {
    return [];
  }
};

/** The server a page belongs to: a joined computer's peer, else its origin */
const hostOf = (event: IpcMainEvent | IpcMainInvokeEvent): string | null => {
  const origin = event.senderFrame?.origin;
  if (!origin || origin === "null") return null;
  return computerAt(origin)?.peer ?? origin;
};

// The page may be another computer's, so it only gets files the user picked
// on a page from that same server
const isAllowed = (host: string | null, filePath: string) =>
  !!host && loadAllowed().some((f) => f.host === host && f.path === filePath);

const allow = (host: string, filePath: string) => {
  const list = loadAllowed();
  if (list.some((f) => f.host === host && f.path === filePath)) return;
  try {
    mkdirSync(shellDir(), { recursive: true });
    writeFileSync(
      allowedFilesPath(),
      JSON.stringify([...list, { host, path: filePath }].slice(-MAX_ALLOWED)),
    );
  } catch (err) {
    logShell("warn", "[linked-files] couldn't save", filePath, err);
  }
};

/**
 * One watch per file, however many pages want it. Only the first page hears
 * of a save, so two open pages don't both re-upload it.
 */
type Shared = {
  watcher: FSWatcher;
  timer?: NodeJS.Timeout;
  pages: Sender[];
};
const watches = new Map<string, Shared>();
const pathsByPage = new Map<number, Set<string>>();

const notify = (filePath: string) => {
  const shared = watches.get(filePath);
  if (!shared) return;
  clearTimeout(shared.timer);
  // PowerPoint saves by renaming a temp file over it; wait until it's quiet
  shared.timer = setTimeout(() => {
    shared.pages
      .find((page) => !page.isDestroyed())
      ?.send("linked-files:changed", filePath);
  }, SETTLE_MS);
};

const subscribe = (page: Sender, filePath: string): boolean => {
  const existing = watches.get(filePath);
  if (existing) {
    existing.pages.push(page);
    return true;
  }
  const name = basename(filePath);
  let watcher: FSWatcher;
  try {
    // The folder, not the file: a watch on the file is lost at the rename
    watcher = watch(dirname(filePath), (_event, file) => {
      const fileName = file?.toString();
      if (!fileName || fileName === name || fileName === `~$${name}`) {
        notify(filePath);
      }
    });
  } catch (err) {
    logShell("warn", "[linked-files] can't watch", filePath, err);
    return false;
  }
  watcher.on("error", (err) =>
    logShell("warn", "[linked-files] stopped watching", filePath, err),
  );
  watches.set(filePath, { watcher, pages: [page] });
  // Catches a save made while it wasn't watched
  notify(filePath);
  return true;
};

const unsubscribe = (page: Sender, filePath: string) => {
  const shared = watches.get(filePath);
  if (!shared) return;
  shared.pages = shared.pages.filter((p) => p !== page && !p.isDestroyed());
  if (shared.pages.length > 0) return;
  clearTimeout(shared.timer);
  shared.watcher.close();
  watches.delete(filePath);
};

const setPagePaths = (page: Sender, wanted: Set<string>) => {
  const current = pathsByPage.get(page.id) ?? new Set<string>();
  for (const filePath of current) {
    if (!wanted.has(filePath)) unsubscribe(page, filePath);
  }
  const kept = new Set<string>();
  for (const filePath of wanted) {
    if (current.has(filePath) || subscribe(page, filePath)) kept.add(filePath);
  }
  if (kept.size > 0) pathsByPage.set(page.id, kept);
  else pathsByPage.delete(page.id);
  return kept;
};

let nodeId: Promise<string | null> | null = null;

export function registerLinkedFilesIPC(): void {
  ipcMain.handle("app:node-id", () => {
    nodeId ??= helper.nodeId().then((id) => {
      if (!id) nodeId = null;
      return id;
    });
    return nodeId;
  });

  // `on`, not `handle`: the page's generic `invoke` can't reach it. Only the
  // preload sends it, with a path Electron gave for a file the user dropped.
  ipcMain.on("linked-files:allow", (event, filePath: unknown) => {
    const host = hostOf(event);
    if (host && typeof filePath === "string" && filePath) {
      allow(host, filePath);
    }
  });

  /** Watches exactly these files for the calling page */
  ipcMain.handle("linked-files:watch", (event, filePaths: unknown) => {
    const page = event.sender;
    const host = hostOf(event);
    const wanted = new Set(
      (Array.isArray(filePaths) ? filePaths : []).filter(
        (p): p is string => typeof p === "string" && isAllowed(host, p),
      ),
    );
    if (!pathsByPage.has(page.id) && wanted.size > 0) {
      page.once("destroyed", () => setPagePaths(page, new Set()));
    }
    return [...setPagePaths(page, wanted)];
  });

  ipcMain.handle("linked-files:read", async (event, filePath: unknown) => {
    if (typeof filePath !== "string" || !isAllowed(hostOf(event), filePath)) {
      throw new Error("This file wasn't linked on this computer.");
    }
    return readFile(filePath);
  });
}
