import ipaddr from "ipaddr.js";

/**
 * Returns true if the URL's host is reachable from the public internet
 */
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

  // IP literal -> only globally-routable unicast addresses are public.
  if (ipaddr.isValid(h)) {
    return ipaddr.parse(h).range() === "unicast";
  }

  // DNS hostname -> assume public.
  return true;
}
