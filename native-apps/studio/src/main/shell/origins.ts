import { runtime } from "../runtime/client";
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
