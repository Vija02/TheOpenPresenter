import { OrganizationType } from "@repo/graphql";

import { expect, test } from "../../../fixtures/projectFixture";

test.describe("Add Scene modal: organization type filtering", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("church organization sees worship-oriented scene creators", async ({
    e2eCommand,
    projectPage,
  }) => {
    await e2eCommand.login({
      orgs: [
        {
          name: "TestChurch",
          slug: "testchurch",
          organizationType: OrganizationType.Church,
          projects: [{ name: "TestProject", slug: "testproject" }],
        },
      ],
      next: "/app/testchurch/testproject",
    });

    await projectPage.newSceneButton.click();

    await expect(projectPage.pluginOption("Lyrics Presenter")).toBeVisible();
    await expect(projectPage.pluginOption("Worship Pads")).toBeVisible();
    // Sanity check: a non-restricted plugin is still listed.
    await expect(projectPage.pluginOption("Video Player")).toBeVisible();
  });

  test("venue organization does not see worship-oriented scene creators", async ({
    e2eCommand,
    projectPage,
  }) => {
    await e2eCommand.login({
      orgs: [
        {
          name: "TestVenue",
          slug: "testvenue",
          organizationType: OrganizationType.Venue,
          projects: [{ name: "TestProject", slug: "testproject" }],
        },
      ],
      next: "/app/testvenue/testproject",
    });

    await projectPage.newSceneButton.click();

    await expect(projectPage.pluginOption("Lyrics Presenter")).toHaveCount(0);
    await expect(projectPage.pluginOption("Worship Pads")).toHaveCount(0);
    // Sanity check: a non-restricted plugin is still listed.
    await expect(projectPage.pluginOption("Video Player")).toBeVisible();
  });
});
