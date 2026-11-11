import { describe, expect, it } from "vitest";

import { type SourceOption, buildCatalog } from "../src/main/screens/sources";

const CLOUD = "https://theopenpresenter.com";
const cloud: SourceOption = {
  source: { kind: "remote", host: CLOUD },
  label: "TheOpenPresenter Cloud",
  account: "Sam",
};
const local: SourceOption = {
  source: { kind: "local" },
  label: "This computer",
  account: null,
};

const org = (slug: string, ...screens: string[]) => ({
  slug,
  name: slug.toUpperCase(),
  screens: screens.map((s) => ({ slug: s, name: s })),
});

describe("buildCatalog", () => {
  it("shows a synced organization once, served from this computer", () => {
    const groups = buildCatalog(
      [local, cloud],
      [[org("grace-2", "hall")], [org("grace", "hall")]],
      [
        {
          slug: "grace-2",
          cloudHost: `${CLOUD}/`,
          cloudOrganizationSlug: "grace",
        },
      ],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.organizations).toEqual([
      expect.objectContaining({
        name: "GRACE",
        syncedTo: CLOUD,
        screens: [
          {
            slug: "hall",
            name: "hall",
            source: { kind: "local" },
            orgSlug: "grace-2",
          },
        ],
      }),
    ]);
  });

  it("keeps a screen not synced down yet, from the account", () => {
    const [group] = buildCatalog(
      [local, cloud],
      [[org("grace")], [org("grace", "foyer")]],
      [{ slug: "grace", cloudHost: CLOUD, cloudOrganizationSlug: "grace" }],
    );
    expect(group!.organizations[0]!.screens).toEqual([
      expect.objectContaining({
        slug: "foyer",
        source: cloud.source,
        orgSlug: "grace",
      }),
    ]);
  });

  it("lists organizations only on this computer last", () => {
    const groups = buildCatalog(
      [local, cloud],
      [[org("home", "tv"), org("away", "tv")], [org("other")]],
      [
        { slug: "home", cloudHost: null, cloudOrganizationSlug: null },
        // Synced to a server nobody is signed in to here.
        {
          slug: "away",
          cloudHost: "https://elsewhere.example",
          cloudOrganizationSlug: "away",
        },
      ],
    );
    expect(groups.map((g) => g.key)).toEqual([CLOUD, "local"]);
    expect(groups[1]!.organizations.map((o) => [o.name, o.syncedTo])).toEqual([
      ["HOME", null],
      ["AWAY", "https://elsewhere.example"],
    ]);
  });

  it("leaves out a source that could not be listed", () => {
    expect(buildCatalog([local, cloud], [null, null], [])).toEqual([]);
  });
});
