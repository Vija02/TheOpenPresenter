import { net, session } from "electron";

import { resetClickerScreen } from "./clicker";
import { hideScreen, resetMainToRenderer } from "./windows";

const SESSION_COOKIE = "connect.sid";

const SCREENS_QUERY =
  "query DesktopScreens { currentUser { id organizationMemberships(first: 20) { nodes { id organization { id name slug screens(orderBy: [NAME_ASC]) { nodes { id name slug } } } } } } }";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScreenItem = { id: string; name: string; slug: string };
export type OrgItem = {
  id: string;
  name: string;
  slug: string;
  screens: ScreenItem[];
};
export type ScreenListResult = { loggedIn: boolean; orgs: OrgItem[] };

type GqlResponse = {
  data?: {
    currentUser?: {
      organizationMemberships: {
        nodes: Array<{
          organization?: {
            id: string;
            name: string;
            slug: string;
            screens: {
              nodes: Array<{ id: string; name: string; slug: string }>;
            };
          };
        }>;
      };
    };
  };
};

/**
 * Exchange a short-lived loginToken for a real session.
 *
 * net.fetch uses session.defaultSession, so Chromium stores the Set-Cookie
 * headers from the redirect response in the shared cookie jar automatically.
 * The same cookies are then sent with subsequent navigation and net.fetch
 * calls from both the main process and browser windows.
 */
export async function establishSession(
  token: string,
  rootUrl: string,
): Promise<void> {
  const base = rootUrl.replace(/\/+$/, "");
  const loginUrl = `${base}/qr-auth/login?token=${encodeURIComponent(token)}&persist-session=1&next=/`;

  const resp = await net.fetch(loginUrl);

  // Verify the session cookie was stored by Chromium during the redirect chain
  const cookies = await session.defaultSession.cookies.get({
    url: rootUrl,
    name: SESSION_COOKIE,
  });

  if (cookies.length === 0) {
    throw new Error(
      `Login did not return a ${SESSION_COOKIE} cookie (HTTP ${resp.status}). ` +
        "The pairing token was probably invalid or already used.",
    );
  }
}

export async function clearSession(rootUrl: string): Promise<void> {
  hideScreen();
  resetClickerScreen();

  const cookies = await session.defaultSession.cookies.get({ url: rootUrl });
  await Promise.all(
    cookies.map((c) => session.defaultSession.cookies.remove(rootUrl, c.name)),
  );

  resetMainToRenderer();
}

export async function listScreens(rootUrl: string): Promise<ScreenListResult> {
  // Check for a session cookie before hitting the GraphQL endpoint
  const sessionCookies = await session.defaultSession.cookies.get({
    url: rootUrl,
    name: SESSION_COOKIE,
  });

  if (sessionCookies.length === 0) {
    return { loggedIn: false, orgs: [] };
  }

  const base = rootUrl.replace(/\/+$/, "");

  // net.fetch automatically includes cookies from session.defaultSession
  const resp = await net.fetch(`${base}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Bypass the server's CSRF guard (same header used by the Tauri client)
      "x-top-csrf-protection": "1",
    },
    body: JSON.stringify({ query: SCREENS_QUERY }),
  });

  const text = await resp.text();
  let parsed: GqlResponse;
  try {
    parsed = JSON.parse(text) as GqlResponse;
  } catch {
    throw new Error(`Unexpected GraphQL response: ${text.slice(0, 200)}`);
  }

  const currentUser = parsed.data?.currentUser;
  if (!currentUser) {
    // Cookie present but session is expired/revoked — treat as logged out
    return { loggedIn: false, orgs: [] };
  }

  const orgs: OrgItem[] = currentUser.organizationMemberships.nodes
    .map((m) => m.organization)
    .filter((o): o is NonNullable<typeof o> => o != null)
    .map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      screens: o.screens.nodes.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
      })),
    }));

  return { loggedIn: true, orgs };
}
