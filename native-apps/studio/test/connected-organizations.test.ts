import { describe, expect, it } from "vitest";

import { markConnectedOrganizations } from "../src/main/cloud/connected";

/**
 * Running onboarding again on an install that is already set up shows the
 * same organisation list as the first time. Connecting one twice creates a
 * second local mirror of the same cloud organisation, so the picker has to
 * know which are already here.
 */

const cloud = [
  { slug: "grace", name: "Grace Church" },
  { slug: "st-marys", name: "St Mary's" },
];

const CLOUD = "https://theopenpresenter.com";

describe("markConnectedOrganizations", () => {
  it("flags the organisation this install already mirrors", () => {
    const choices = markConnectedOrganizations(
      cloud,
      [
        {
          slug: "grace",
          name: "Grace Church",
          cloudHost: CLOUD,
          cloudOrganizationSlug: "grace",
        },
      ],
      CLOUD,
    );

    expect(choices.find((c) => c.slug === "grace")?.connected).toBe(true);
    expect(choices.find((c) => c.slug === "st-marys")?.connected).toBe(false);
  });

  it("leaves everything selectable on a fresh install", () => {
    const choices = markConnectedOrganizations(cloud, [], CLOUD);
    expect(choices.every((c) => !c.connected)).toBe(true);
  });

  /**
   * A local-only organisation has no cloud connection, so it must never
   * suppress a cloud organisation that happens to share its slug.
   */
  it("ignores organisations that are not synced anywhere", () => {
    const choices = markConnectedOrganizations(
      cloud,
      [
        {
          slug: "grace",
          name: "Grace Church",
          cloudHost: null,
          cloudOrganizationSlug: null,
        },
      ],
      CLOUD,
    );

    expect(choices.find((c) => c.slug === "grace")?.connected).toBe(false);
  });

  /**
   * Two servers can both have an organisation called `grace`. Mirroring the
   * one on a self-hosted box says nothing about the cloud's.
   */
  it("does not match the same slug on a different server", () => {
    const choices = markConnectedOrganizations(
      cloud,
      [
        {
          slug: "grace",
          name: "Grace Church",
          cloudHost: "https://presenter.mychurch.org",
          cloudOrganizationSlug: "grace",
        },
      ],
      CLOUD,
    );

    expect(choices.find((c) => c.slug === "grace")?.connected).toBe(false);
  });

  /** The same server written three ways is still one server. */
  it("treats trailing slashes and missing schemes as the same host", () => {
    for (const host of [
      "https://theopenpresenter.com/",
      "theopenpresenter.com",
      "https://TheOpenPresenter.com",
    ]) {
      const choices = markConnectedOrganizations(
        cloud,
        [
          {
            slug: "grace",
            name: "Grace Church",
            cloudHost: host,
            cloudOrganizationSlug: "grace",
          },
        ],
        CLOUD,
      );

      expect(choices.find((c) => c.slug === "grace")?.connected).toBe(true);
    }
  });

  /**
   * The local mirror can be renamed, so naming it in the picker is clearer
   * than repeating the cloud name back at the user.
   */
  it("reports the local name of the mirror", () => {
    const choices = markConnectedOrganizations(
      cloud,
      [
        {
          slug: "grace-2",
          name: "Grace (this PC)",
          cloudHost: CLOUD,
          cloudOrganizationSlug: "grace",
        },
      ],
      CLOUD,
    );

    expect(choices.find((c) => c.slug === "grace")?.localName).toBe(
      "Grace (this PC)",
    );
  });
});
