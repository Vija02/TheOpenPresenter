import { isAbsolute, join, relative } from "path";
import { fileURLToPath } from "url";

import { runtime } from "../runtime/client";
import { screenHosts } from "../screens/config";
import { getSettings } from "../settings/store";

function allowedOrigins(): string[] {
  const origins: string[] = [];

  const push = (value: string | null | undefined) => {
    if (!value) return;
    try {
      origins.push(new URL(value).origin);
    } catch {
      // A malformed setting simply grants nothing.
    }
  };

  push(runtime.url);
  push(getSettings().rootUrl);
  push(process.env["ELECTRON_RENDERER_URL"]);
  // Hosts the user picked a screen from, which may not be the app's own.
  for (const host of screenHosts()) push(host);

  return origins;
}

export function isAllowedAppUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  return allowedOrigins().includes(parsed.origin);
}

/** One of Studio's own pages, not a page from a server. */
export function isShellPage(
  url: string | undefined,
  rendererUrl = process.env["ELECTRON_RENDERER_URL"],
  rendererDir = join(__dirname, "../renderer"),
): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (rendererUrl) return parsed.origin === new URL(rendererUrl).origin;
    if (parsed.protocol !== "file:") return false;
    const rel = relative(rendererDir, fileURLToPath(parsed));
    return !!rel && !rel.startsWith("..") && !isAbsolute(rel);
  } catch {
    return false;
  }
}
