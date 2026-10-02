import { afterEach, describe, expect, it, vi } from "vitest";

import { selectOrganization } from "../src/main/cloud/connection";

/**
 * The silent failure that made onboarding look like it worked.
 *
 * Row level security narrows an unauthorised UPDATE to zero rows rather than
 * refusing it, so postgraphile answers 200 with a null payload. Every call
 * here therefore "succeeds" at the HTTP level; what matters is whether the
 * value was actually stored.
 */

const BASE = "http://localhost:5678";

/** A local server that answers the update mutation with `payload`. */
function serverReturning(payload: unknown) {
  const requests: { headers: Record<string, string> }[] = [];

  const fetch = vi.fn((_url: string, init: any) => {
    requests.push({ headers: init.headers });
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    } as Response);
  });

  return { requests, fetch };
}

async function useServer(server: { fetch: unknown }) {
  const electron = await import("electron");
  (electron.net as any).fetch = server.fetch;
  return electron;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("selectOrganization", () => {
  /**
   * The exact shape postgraphile returns when RLS blocked the write: no
   * errors, and a null connection. Treating that as success left
   * target_organization_slug unset, and the sync worker aborts without it.
   */
  it("fails when the server stored nothing", async () => {
    const server = serverReturning({
      data: { updateCloudConnection: { cloudConnection: null } },
    });
    await useServer(server);

    await expect(
      selectOrganization(BASE, "connection-1", "grace"),
    ).rejects.toThrow(/stored nothing/);
  });

  /** A stored value that is not the one asked for is equally not success. */
  it("fails when the server stored a different organisation", async () => {
    const server = serverReturning({
      data: {
        updateCloudConnection: {
          cloudConnection: {
            id: "connection-1",
            targetOrganizationSlug: "other",
          },
        },
      },
    });
    await useServer(server);

    await expect(
      selectOrganization(BASE, "connection-1", "grace"),
    ).rejects.toThrow();
  });

  it("accepts a write the server confirms", async () => {
    const server = serverReturning({
      data: {
        updateCloudConnection: {
          cloudConnection: {
            id: "connection-1",
            targetOrganizationSlug: "grace",
          },
        },
      },
    });
    await useServer(server);

    await expect(
      selectOrganization(BASE, "connection-1", "grace"),
    ).resolves.toBeUndefined();
  });

  /**
   * The cause of the empty write: requests carried no session, so the local
   * server saw an anonymous visitor and RLS hid the row.
   */
  it("sends the local server's session cookie", async () => {
    const server = serverReturning({
      data: {
        updateCloudConnection: {
          cloudConnection: {
            id: "connection-1",
            targetOrganizationSlug: "grace",
          },
        },
      },
    });
    const electron = await useServer(server);
    (electron.session.defaultSession.cookies as any).get = () =>
      Promise.resolve([{ name: "connect.sid", value: "s:abc123" }]);

    await selectOrganization(BASE, "connection-1", "grace");

    expect(server.requests[0].headers.Cookie).toBe("connect.sid=s:abc123");
  });

  /** Signed out is a real state; it must not crash before the clear error. */
  it("still sends the request when there is no session cookie", async () => {
    const server = serverReturning({
      data: { updateCloudConnection: { cloudConnection: null } },
    });
    const electron = await useServer(server);
    (electron.session.defaultSession.cookies as any).get = () =>
      Promise.resolve([]);

    await expect(
      selectOrganization(BASE, "connection-1", "grace"),
    ).rejects.toThrow(/stored nothing/);

    expect(server.requests[0].headers.Cookie).toBeUndefined();
  });
});
