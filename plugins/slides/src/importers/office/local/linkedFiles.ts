import { createHash } from "node:crypto";
import path from "node:path";

import type { LinkRequest } from "../../../types";
import { DECK_EXTENSIONS } from "./convertPptToPdfLocally";

// Only Studio's runtime can link files
export const linkedFilesEnabled = () => process.env.TOP_MANAGED === "1";

/** Throws what's wrong with a path sent to be linked */
export const parseLinkedPath = (filePath: string): string => {
  // The file may be on a joined computer with a different OS
  if (!path.win32.isAbsolute(filePath) && !path.posix.isAbsolute(filePath)) {
    throw new Error("Couldn't find where this file is on the computer.");
  }
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (!DECK_EXTENSIONS.includes(extension)) {
    throw new Error("Only PowerPoint files (.pptx, .ppt) can be linked.");
  }
  return filePath;
};

/** Throws unless this server can take the link */
export const checkLinkRequest = (link: LinkRequest): LinkRequest => {
  if (!linkedFilesEnabled()) {
    throw new Error("Linking a file only works in TheOpenPresenter Studio.");
  }
  if (!/^[0-9a-f]{64}$/.test(link.watchedBy)) {
    throw new Error("Couldn't tell which computer the file is on.");
  }
  return { path: parseLinkedPath(link.path), watchedBy: link.watchedBy };
};

export const hashFile = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
