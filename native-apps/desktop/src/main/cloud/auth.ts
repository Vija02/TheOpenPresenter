import { net, session } from "electron";

/**
 * Browser-handoff login, reusing the server's `/qr-auth` flow.
 */

const SESSION_COOKIE = "connect.sid";

export type LoginHandle = {
  /** Where to send the browser. Exposed so the UI can offer a copyable link. */
  authUrl: string;
  /** Resolves once the session cookie is in place. */
  completed: Promise<void>;
  cancel: () => void;
};

/** Thrown when the server has no Redis and so cannot run the handoff. */
export class BrowserLoginUnavailable extends Error {
  constructor(status: number) {
    super(
      `This server does not support browser sign-in (HTTP ${status} from ` +
        `/qr-auth/request). Sign in in this window instead.`,
    );
    this.name = "BrowserLoginUnavailable";
  }
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function beginBrowserLogin(
  rootUrl: string,
  next = "/o",
): Promise<LoginHandle> {
  const base = rootUrl.replace(/\/+$/, "");
  const controller = new AbortController();

  const response = await net.fetch(`${base}/qr-auth/request`, {
    headers: { Accept: "text/event-stream" },
    signal: controller.signal,
  });

  if (!response.ok || !response.body) {
    throw new BrowserLoginUnavailable(response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // The auth URL is built from the id, so the handle is not returned until
  // that first message lands.
  const id = deferred<string>();
  const completed = deferred<void>();

  void (async () => {
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let split: number;
        while ((split = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);

          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;

            let message: { id?: string; done?: boolean; token?: string };
            try {
              message = JSON.parse(payload);
            } catch {
              continue;
            }

            if (message.id) id.resolve(message.id);

            if (message.done && message.token) {
              // Closed before the exchange so the server is not left holding
              // an SSE client.
              controller.abort();
              try {
                await exchangeToken(base, message.token, next);
                completed.resolve();
              } catch (err) {
                // Must not be mistaken for the abort above: a failed exchange
                // is exactly the case the user needs told about.
                completed.reject(err as Error);
              }
              return;
            }
          }
        }
      }
      completed.reject(new Error("Sign-in stream closed before completing"));
    } catch (err) {
      if (controller.signal.aborted) return;
      id.reject(err as Error);
      completed.reject(err as Error);
    }
  })();

  const resolvedId = await id.promise;

  return {
    authUrl: `${base}/qr-auth/auth?id=${encodeURIComponent(resolvedId)}`,
    completed: completed.promise,
    cancel: () => controller.abort(),
  };
}

async function exchangeToken(
  base: string,
  token: string,
  next: string,
): Promise<void> {
  const url =
    `${base}/qr-auth/login?token=${encodeURIComponent(token)}` +
    `&persist-session=1&next=${encodeURIComponent(next)}`;

  const response = await net.fetch(url);

  const cookies = await session.defaultSession.cookies.get({
    url: base,
    name: SESSION_COOKIE,
  });

  if (cookies.length === 0) {
    throw new Error(
      `Sign-in did not return a session cookie (HTTP ${response.status}). ` +
        `The token was probably already used or had expired.`,
    );
  }
}

/**
 * The cloud session this shell holds, in the form the local server stores it.
 * Reading the cookie back is what lets the local server adopt the session
 * rather than running a second login of its own.
 */
export async function cloudSessionCookie(
  rootUrl: string,
): Promise<{ cookie: string; expiry: string | null } | null> {
  const base = rootUrl.replace(/\/+$/, "");
  const cookies = await session.defaultSession.cookies.get({
    url: base,
    name: SESSION_COOKIE,
  });

  const found = cookies[0];
  if (!found) return null;

  return {
    cookie: `${found.name}=${found.value}`,
    // Session cookies have no expiry; the server falls back to a month.
    expiry: found.expirationDate
      ? new Date(found.expirationDate * 1000).toISOString()
      : null,
  };
}
