import { OrganizationType } from "@repo/graphql";

import { expect, test } from "../../../../../fixtures/projectFixture";
import {
  projectUrl,
  tagged,
  taggedUser,
} from "../../../../../helpers/workerData";

test.describe("Music Player Plugin: Radio", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("worship organization only sees worship sources", async ({
    page,
    e2eCommand,
    projectPage,
    musicPlayerPlugin,
  }) => {
    await e2eCommand.login({
      username: taggedUser("testuser_church"),
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

    await projectPage.createPlugin("Music Player");
    await musicPlayerPlugin.radioTab.click();

    await expect(page.getByText("Worship Radio 247")).toBeVisible();
    await expect(page.getByText("AllWorship Christmas Worship")).toBeVisible();
    await expect(page.getByText("BBC World Service")).not.toBeVisible();
  });

  test("venue organization sees a wider variety of radio stations", async ({
    page,
    e2eCommand,
    projectPage,
    musicPlayerPlugin,
  }) => {
    await e2eCommand.login({
      username: taggedUser("testuser_venue"),
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

    await projectPage.createPlugin("Music Player");
    await musicPlayerPlugin.radioTab.click();

    await expect(page.getByText("BBC World Service")).toBeVisible();
    await expect(page.getByText("Radio Paradise (Eclectic Mix)")).toBeVisible();
    await expect(page.getByText("SomaFM Groove Salad")).toBeVisible();
    await expect(page.getByText("Worship Radio 247")).not.toBeVisible();
  });
});
