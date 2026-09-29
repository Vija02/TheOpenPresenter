import { net, session } from "electron";

const SESSION_COOKIE = "connect.sid";

export type Account = {
  name: string | null;
  username: string;
  email: string | null;
};

// Mostly for cloud auth
export async function currentAccount(rootUrl: string): Promise<Account | null> {
  const base = rootUrl.replace(/\/+$/, "");
  if (!base) return null;

  const cookies = await session.defaultSession.cookies.get({
    url: base,
    name: SESSION_COOKIE,
  });
  const cookie = cookies[0];
  if (!cookie) return null;

  try {
    const response = await net.fetch(`${base}/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-top-csrf-protection": "1",
        Cookie: `${cookie.name}=${cookie.value}`,
      },
      body: JSON.stringify({
        query: `query {
          currentUser {
            name
            username
            userEmails(first: 1, condition: { isPrimary: true }) {
              nodes { email }
            }
          }
        }`,
      }),
    });

    const parsed = (await response.json()) as {
      data?: {
        currentUser?: {
          name: string | null;
          username: string;
          userEmails?: { nodes: { email: string }[] };
        } | null;
      };
    };

    const user = parsed.data?.currentUser;
    if (!user?.username) return null;

    return {
      name: user.name ?? null,
      username: user.username,
      email: user.userEmails?.nodes?.[0]?.email ?? null,
    };
  } catch {
    // Only ever decorates a screen, so an unreachable or older server should
    // leave the account blank rather than break the page around it.
    return null;
  }
}
