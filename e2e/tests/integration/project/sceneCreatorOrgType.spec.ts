import { OrganizationType } from "@repo/graphql";

import { expect, test } from "../../../fixtures/projectFixture";
import { projectUrl, tagged } from "../../../helpers/workerData";

test.describe("Add Scene page: organization type filtering", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("church organization sees worship-oriented scene creators", async ({
    e2eCommand,
    projectPage,
  }) => {
    await e2eCommand.login({
      orgs: [
        {
          name: "TestChurch",
          slug: tagged("testchurch"),
          organizationType: OrganizationType.Church,
          projects: [{ name: "TestProject", slug: "testproject" }],
        },
      ],
      next: projectUrl(tagged("testchurch")),
    });

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
          slug: tagged("testvenue"),
          organizationType: OrganizationType.Venue,
          projects: [{ name: "TestProject", slug: "testproject" }],
        },
      ],
      next: projectUrl(tagged("testvenue")),
    });

    await expect(projectPage.pluginOption("Lyrics Presenter")).toHaveCount(0);
    await expect(projectPage.pluginOption("Worship Pads")).toHaveCount(0);
    // Sanity check: a non-restricted plugin is still listed.
    await expect(projectPage.pluginOption("Video Player")).toBeVisible();
  });
});
