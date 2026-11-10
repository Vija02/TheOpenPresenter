import { describe, expect, it } from "vitest";

import type {
  LocalOrganization,
  SignedInAccount,
} from "../src/renderer/bridge/ipc";
import { groupOrganizations } from "../src/renderer/settings/groupOrganizations";

const local = (
  id: string,
  cloudHost: string | null = null,
  cloudOrganizationSlug: string | null = null,
): LocalOrganization => ({
  id,
  slug: id,
  name: id,
  cloudHost,
  cloudOrganizationSlug,
  cloudConnectionId: cloudHost ? `conn-${id}` : null,
  isOwner: true,
  projectCount: 0,
  mediaCount: 0,
});

const account = (rootUrl: string, slugs: string[] | null): SignedInAccount => ({
  rootUrl,
  label: rootUrl,
  isCloud: false,
  current: false,
  status: "ok",
  account: { name: null, username: "me", email: "me@example.com" },
  organizations: slugs?.map((slug) => ({ slug, name: slug })) ?? null,
});

describe("groupOrganizations", () => {
  it("marks each account organization synced or online only", () => {
    const groups = groupOrganizations(
      [account("https://theopenpresenter.com", ["grace", "hope"])],
      [local("grace-local", "https://theopenpresenter.com/", "grace")],
    );

    expect(groups.accounts[0].rows.map((r) => r.kind)).toEqual([
      "synced",
      "online",
    ]);
    expect(groups.thisComputer).toEqual([]);
  });

  it("shows every signed-in account", () => {
    const groups = groupOrganizations(
      [
        account("https://theopenpresenter.com", ["grace"]),
        account("https://presenter.church.org", ["stmary"]),
      ],
      [local("stmary-local", "presenter.church.org", "stmary")],
    );

    expect(groups.accounts).toHaveLength(2);
    expect(groups.accounts[0].rows[0].kind).toBe("online");
    expect(groups.accounts[1].rows[0].kind).toBe("synced");
  });

  it("keeps local-only organizations, and copies of signed-out accounts, on this computer", () => {
    const groups = groupOrganizations(
      [account("https://theopenpresenter.com", ["grace"])],
      [local("ours"), local("old", "https://signed-out.example", "old")],
    );

    expect(groups.thisComputer.map((o) => o.id)).toEqual(["ours", "old"]);
  });

  it("keeps a copy with its account even when the account no longer lists it", () => {
    const groups = groupOrganizations(
      [account("https://theopenpresenter.com", [])],
      [local("left", "https://theopenpresenter.com", "left")],
    );

    expect(groups.accounts[0].rows).toEqual([
      expect.objectContaining({ kind: "synced" }),
    ]);
    expect(groups.thisComputer).toEqual([]);
  });

  it("still places copies when the account's organizations could not load", () => {
    const groups = groupOrganizations(
      [account("https://theopenpresenter.com", null)],
      [local("grace", "https://theopenpresenter.com", "grace")],
    );

    expect(groups.accounts[0].rows).toHaveLength(1);
    expect(groups.thisComputer).toEqual([]);
  });
});
