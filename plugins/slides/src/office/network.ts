import axios from "axios";
import ipaddr from "ipaddr.js";

export function isPubliclyAccessibleUrl(urlStr: string | undefined): boolean {
  if (!urlStr) return false;

  let host: string;
  try {
    host = new URL(urlStr).hostname;
  } catch {
    return false;
  }
  if (!host) return false;

  const h = host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return false;
  }

  // IP literal -> Only globally-routable unicast addresses are public
  if (ipaddr.isValid(h)) {
    return ipaddr.parse(h).range() === "unicast";
  }

  // DNS hostname -> assume public.
  return true;
}

export async function isOnline(timeoutMs = 5000): Promise<boolean> {
  try {
    await axios.head("https://view.officeapps.live.com/", {
      timeout: timeoutMs,
      validateStatus: () => true,
    });
    return true;
  } catch {
    return false;
  }
}
