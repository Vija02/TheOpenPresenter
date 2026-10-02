import { afterEach, describe, expect, it, vi } from "vitest";

import { connectCloudOrganization } from "../src/main/cloud/connection";

/**
 * Connecting a cloud organisation has to leave the install actually syncing,
 * not merely pointed at a target. The sync is the whole point of choosing an
 * organisation, so it is part of connecting rather than a later step the user
 * has to find in Settings.
 */

type Call = { path: string; body: any };

/**
 * A local server that records what it was asked to do. GraphQL and the
 * /cloud/adopt endpoint both go through net.fetch, so one stub covers both.
 */
function fakeServer({ syncFails = false }: { syncFails?: boolean } = {}) {
  const calls: Call[] = [];

  const reply = (payload: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    } as Response);

  const fetch = vi.fn((url: string, init: any) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body);
    const query: string = body.query ?? "";
    calls.push({ path, body });

    if (path === "/cloud/adopt") return reply({ id: "connection-1" });

    if (query.includes("createOrganization")) {
      return reply({
        data: {
          createOrganization: { organization: { id: "org-1", slug: "grace" } },
        },
      });
    }

    if (query.includes("cloudConnections")) {
      return reply({
        data: {
          organizationBySlug: {
            cloudConnections: {
              nodes: [
                {
                  id: "connection-1",
                  host: "https://theopenpresenter.com",
                  organizationList: [],
                  targetOrganizationSlug: null,
                },
              ],
            },
          },
        },
      });
    }

    // allOrganizations, used to pick a free slug
    if (query.includes("organizations")) {
      return reply({ data: { organizations: { nodes: [] } } });
    }

    if (query.includes("updateCloudConnection")) {
      return reply({
        data: {
          updateCloudConnection: {
            cloudConnection: {
              id: "connection-1",
              targetOrganizationSlug: "grace",
            },
          },
        },
      });
    }

    if (query.includes("syncCloudConnection")) {
      if (syncFails) {
        return reply({ errors: [{ message: "worker unavailable" }] });
      }
      return reply({ data: { syncCloudConnection: { success: true } } });
    }

    throw new Error(`unexpected request: ${path} ${query.slice(0, 60)}`);
  });

  return { calls, fetch };
}

/** The shell already holds a cloud session by the time an org is picked. */
vi.mock("../src/main/cloud/auth", () => ({
  cloudSessionCookie: () =>
    Promise.resolve({ cookie: "session=abc", expiry: "2030-01-01T00:00:00Z" }),
}));

const graphqlCalls = (calls: Call[]) =>
  calls.filter((c) => c.path === "/graphql").map((c) => c.body.query as string);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("connectCloudOrganization", () => {
  it("starts syncing rather than only recording the target", async () => {
    const server = fakeServer();
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;

    const result = await connectCloudOrganization(
      "http://localhost:5678",
      "https://theopenpresenter.com",
      { slug: "grace", name: "Grace Church" },
    );

    expect(result.targetOrganizationSlug).toBe("grace");

    const queries = graphqlCalls(server.calls);
    expect(queries.some((q) => q.includes("syncCloudConnection"))).toBe(true);
  });

  /**
   * Onboarding opens this organisation afterwards. The local mirror's slug is
   * uniquified, so returning the cloud slug would open the wrong one on an
   * install that already had an organisation of that name.
   */
  it("reports the local mirror's slug, not the cloud one", async () => {
    const server = fakeServer();
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;

    const result = await connectCloudOrganization(
      "http://localhost:5678",
      "https://theopenpresenter.com",
      { slug: "grace", name: "Grace Church" },
    );

    expect(result.localOrganizationSlug).toBe("grace");
    expect(result.targetOrganizationSlug).toBe("grace");
  });

  /**
   * Order matters: the worker aborts when target_organization_slug is unset,
   * so a sync queued before the target is chosen would silently do nothing.
   */
  it("chooses the target before asking for a sync", async () => {
    const server = fakeServer();
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;

    await connectCloudOrganization(
      "http://localhost:5678",
      "https://theopenpresenter.com",
      { slug: "grace", name: "Grace Church" },
    );

    const queries = graphqlCalls(server.calls);
    const target = queries.findIndex((q) =>
      q.includes("updateCloudConnection"),
    );
    const sync = queries.findIndex((q) => q.includes("syncCloudConnection"));

    expect(target).toBeGreaterThanOrEqual(0);
    expect(sync).toBeGreaterThan(target);
  });

  /**
   * The connection is stored and targeted by this point. Reporting a failed
   * connection because the sync could not be queued would strand the user on
   * the organisation picker with nothing wrong to fix.
   */
  it("still connects when the sync cannot be queued", async () => {
    const server = fakeServer({ syncFails: true });
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await connectCloudOrganization(
      "http://localhost:5678",
      "https://theopenpresenter.com",
      { slug: "grace", name: "Grace Church" },
    );

    expect(result.targetOrganizationSlug).toBe("grace");
  });
});
