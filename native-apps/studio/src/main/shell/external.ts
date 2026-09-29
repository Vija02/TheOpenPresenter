import { shell } from "electron";

const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export async function openExternalSafely(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.warn("[shell] refused an unparseable external URL");
    return false;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    console.warn(`[shell] refused external URL with scheme ${parsed.protocol}`);
    return false;
  }

  await shell.openExternal(parsed.toString());
  return true;
}
