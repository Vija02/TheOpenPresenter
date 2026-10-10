import { type Server, createServer } from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The browser-handoff sign-in against a real HTTP server speaking the same SSE
 * shape as `/qr-auth/request`. Electron's `net.fetch` is stubbed onto Node's
 * `fetch`: both return a WHATWG Response with a streaming body, which is the
 * only part this code depends on.
 */

const cookieJar: Array<{ name: string }> = [];

vi.mock("electron", () => ({
  net: { fetch: (...args: Parameters<typeof fetch>) => fetch(...args) },
  session: {
    defaultSession: {
      cookies: {
        get: async () => cookieJar,
      },
    },
  },
}));

const { BrowserLoginUnavailable, beginBrowserLogin } = await import(
  "../src/main/cloud/auth"
);

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  cookieJar.length = 0;
});

type Behaviour = {
  /** HTTP status for /qr-auth/request. */
  requestStatus?: number;
  /** Emit the token this long after the id. */
  tokenDelayMs?: number;
  /** Set a session cookie when the token is exchanged. */
  grantCookie?: boolean;
};

async function startServer(behaviour: Behaviour = {}): Promise<string> {
  const {
    requestStatus = 200,
    tokenDelayMs = 20,
    grantCookie = true,
  } = behaviour;

  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/qr-auth/request") {
      if (requestStatus !== 200) {
        res.writeHead(requestStatus);
        res.end();
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      });
      res.write(`data: ${JSON.stringify({ id: "test-id-123" })}\n\n`);
      setTimeout(() => {
        res.write(
          `data: ${JSON.stringify({ done: true, token: "tok-abc" })}\n\n`,
        );
      }, tokenDelayMs);
      return;
    }

    if (url.pathname === "/qr-auth/login") {
      if (grantCookie && url.searchParams.get("token") === "tok-abc") {
        cookieJar.push({ name: "connect.sid" });
        res.writeHead(200);
        res.end("ok");
      } else {
        res.writeHead(400);
        res.end("bad token");
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const { port } = server!.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe("browser sign-in", () => {
  it("returns an auth URL built from the id the server sends", async () => {
    const base = await startServer({ tokenDelayMs: 10_000 });
    const handle = await beginBrowserLogin(base);

    expect(handle.authUrl).toBe(`${base}/qr-auth/auth?id=test-id-123`);
    handle.cancel();
  });

  it("offers a registration URL that returns to the same handoff", async () => {
    // Registering follows `next`, so a new account lands on /qr-auth/auth
    // already signed in and this shell is signed in with it.
    const base = await startServer({ tokenDelayMs: 10_000 });
    const handle = await beginBrowserLogin(base);

    expect(handle.registerUrl).toBe(
      `${base}/register?next=${encodeURIComponent(
        `/qr-auth/auth?id=test-id-123&next=${encodeURIComponent("/onboarding")}`,
      )}`,
    );
    handle.cancel();
  });

  it("completes once the server releases the token", async () => {
    const base = await startServer();
    const handle = await beginBrowserLogin(base);

    await expect(handle.completed).resolves.toBeUndefined();
    // A session cookie now exists in the shared jar, so the window can simply
    // navigate.
    expect(cookieJar.map((c) => c.name)).toContain("connect.sid");
  });

  it("passes the requested landing page through to the exchange", async () => {
    const base = await startServer();
    const seen: string[] = [];
    const original = server!.listeners("request")[0] as (...a: any[]) => void;
    server!.removeAllListeners("request");
    server!.on("request", (req, res) => {
      seen.push(req.url ?? "");
      original(req, res);
    });

    const handle = await beginBrowserLogin(base, "/o/mychurch");
    await handle.completed;

    const login = seen.find((u) => u.startsWith("/qr-auth/login"));
    expect(login).toContain(`next=${encodeURIComponent("/o/mychurch")}`);
    expect(login).toContain("persist-session=1");
  });

  it("reports servers that cannot do the handoff distinctly", async () => {
    // A server without Redis answers /qr-auth with an error, which must be
    // recognisable so the UI can fall back rather than dead-ending.
    const base = await startServer({ requestStatus: 503 });

    await expect(beginBrowserLogin(base)).rejects.toBeInstanceOf(
      BrowserLoginUnavailable,
    );
  });

  it("fails loudly when the exchange does not set a session", async () => {
    const base = await startServer({ grantCookie: false });
    const handle = await beginBrowserLogin(base);

    await expect(handle.completed).rejects.toThrow(/session cookie/i);
  });

  it("cancelling stops the stream without rejecting", async () => {
    const base = await startServer({ tokenDelayMs: 10_000 });
    const handle = await beginBrowserLogin(base);

    let settled = false;
    void handle.completed.then(
      () => (settled = true),
      () => (settled = true),
    );

    handle.cancel();
    await new Promise((r) => setTimeout(r, 50));

    // A user-initiated cancel is not an error to report back at them.
    expect(settled).toBe(false);
  });
});
