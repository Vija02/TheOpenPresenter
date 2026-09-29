import { net, session } from "electron";
import { networkInterfaces } from "os";

/** This machine's address on the local network, if it has one. */
export function localAddress(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (address.address.startsWith("169.254.")) continue;
      return address.address;
    }
  }
  return null;
}

const PROBE_TIMEOUT_MS = 5000;
const SESSION_COOKIE = "connect.sid";

/** Can we reach this server at all? Used before committing to a host. */
export async function checkHost(url: string): Promise<boolean> {
  if (!url) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await net.fetch(url, { signal: controller.signal });
    // Any HTTP answer proves something is listening: a login redirect or a
    // 403 is still a reachable server.
    return response.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Wait for a server to come up, reporting each attempt. */
export async function waitForHost(
  url: string,
  onAttempt: (attempt: number) => void,
  intervalMs = 2000,
  timeoutMs = 120_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    onAttempt(attempt);
    if (await checkHost(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function isLoggedIn(rootUrl: string): Promise<boolean> {
  if (!rootUrl) return false;
  const cookies = await session.defaultSession.cookies.get({
    url: rootUrl,
    name: SESSION_COOKIE,
  });
  return cookies.length > 0;
}

export async function logout(rootUrl: string): Promise<void> {
  const cookies = await session.defaultSession.cookies.get({ url: rootUrl });
  await Promise.all(
    cookies.map((cookie) =>
      session.defaultSession.cookies.remove(rootUrl, cookie.name),
    ),
  );
}
