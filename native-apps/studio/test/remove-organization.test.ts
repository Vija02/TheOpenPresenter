import { afterEach, describe, expect, it, vi } from "vitest";

import { removeOrganization } from "../src/main/cloud/connection";

/**
 * Removing an organisation deletes it from this computer only. A synced one
 * has to be unlinked before it is deleted: otherwise its projects and media
 * going here would read as deletions to push to the cloud.
 */

type Org = {
  id: string;
  connectionId: string | null;
  isOwner?: boolean;
};

function fakeServer(orgs: Org[], { deleteIgnored = false } = {}) {
  let remaining = [...orgs];
  const queries: string[] = [];

  const reply = (payload: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(payload)),
    } as Response);

  const fetch = vi.fn((_url: string, init: any) => {
    const body = JSON.parse(init.body);
    const query: string = body.query ?? "";
    queries.push(query);

    if (query.includes("deleteCloudConnection")) {
      return reply({ data: { deleteCloudConnection: {} } });
    }
    if (query.includes("deleteOrganization")) {
      // Like the server, a delete by a non-owner is skipped without an error
      if (!deleteIgnored) {
        remaining = remaining.filter((o) => o.id !== body.variables.id);
      }
      return reply({ data: { deleteOrganization: {} } });
    }
    if (query.includes("organizations")) {
      return reply({
        data: {
          organizations: {
            nodes: remaining.map((o) => ({
              id: o.id,
              slug: o.id,
              name: o.id,
              currentUserIsOwner: o.isOwner ?? true,
              projects: { totalCount: 0 },
              medias: { totalCount: 0 },
              cloudConnections: {
                nodes: o.connectionId
                  ? [
                      {
                        id: o.connectionId,
                        host: "https://theopenpresenter.com",
                        targetOrganizationSlug: "grace",
                      },
                    ]
                  : [],
              },
            })),
          },
        },
      });
    }
    throw new Error(`unexpected request: ${query.slice(0, 60)}`);
  });

  return { queries, fetch };
}

const mutations = (queries: string[]) =>
  queries
    .map((q) => q.match(/delete(CloudConnection|Organization)/)?.[0])
    .filter(Boolean);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("removeOrganization", () => {
  it("unlinks a synced organization before deleting it", async () => {
    const server = fakeServer([{ id: "org-1", connectionId: "connection-1" }]);
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;

    await removeOrganization("http://localhost:5678", "org-1");

    expect(mutations(server.queries)).toEqual([
      "deleteCloudConnection",
      "deleteOrganization",
    ]);
  });

  it("only deletes a local organization", async () => {
    const server = fakeServer([{ id: "org-1", connectionId: null }]);
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;

    await removeOrganization("http://localhost:5678", "org-1");

    expect(mutations(server.queries)).toEqual(["deleteOrganization"]);
  });

  it("refuses for someone who is not an owner", async () => {
    const server = fakeServer([
      { id: "org-1", connectionId: "connection-1", isOwner: false },
    ]);
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;

    await expect(
      removeOrganization("http://localhost:5678", "org-1"),
    ).rejects.toThrow(/owner/);
    expect(mutations(server.queries)).toEqual([]);
  });

  it("fails when the server kept the organization", async () => {
    const server = fakeServer([{ id: "org-1", connectionId: null }], {
      deleteIgnored: true,
    });
    const electron = await import("electron");
    (electron.net as any).fetch = server.fetch;

    await expect(
      removeOrganization("http://localhost:5678", "org-1"),
    ).rejects.toThrow(/could not be deleted/);
  });
});
