import { describe, expect, it } from "vitest";

import { localPageFor } from "../src/main/shell/samePage";

const ROOT = "https://theopenpresenter.com";
const mirrors = [
  {
    slug: "grace-local",
    cloudHost: "https://theopenpresenter.com",
    cloudOrganizationSlug: "grace",
  },
  {
    slug: "other",
    cloudHost: "https://presenter.example.org",
    cloudOrganizationSlug: "hope",
  },
];

describe("localPageFor", () => {
  it("opens the same project, under the local organization slug", () => {
    expect(
      localPageFor(`${ROOT}/app/grace/sunday-service?tab=1#x`, ROOT, mirrors),
    ).toEqual({
      path: "/app/grace-local/sunday-service?tab=1#x",
      fallback: "/o/grace-local",
      project: { organizationSlug: "grace-local", slug: "sunday-service" },
    });
  });

  it("opens the same organization page", () => {
    expect(localPageFor(`${ROOT}/o/grace/media`, ROOT, mirrors)).toEqual({
      path: "/o/grace-local/media",
      fallback: "/o/grace-local",
    });
  });

  it("opens the organization when the project part is missing", () => {
    expect(localPageFor(`${ROOT}/app/grace`, ROOT, mirrors)?.path).toBe(
      "/o/grace-local",
    );
  });

  it("has nothing for an organization not on this computer", () => {
    expect(localPageFor(`${ROOT}/o/hope`, ROOT, mirrors)).toBeNull();
  });

  it("has nothing for another server's page", () => {
    expect(
      localPageFor("https://presenter.example.org/o/hope", ROOT, mirrors),
    ).toBeNull();
  });

  it("has nothing for pages outside an organization", () => {
    expect(localPageFor(`${ROOT}/settings`, ROOT, mirrors)).toBeNull();
    expect(localPageFor(`${ROOT}/o`, ROOT, mirrors)).toBeNull();
  });
});
