import { OrganizationType } from "@repo/graphql";
import { expect, test } from "../../../../../fixtures/projectFixture";

test.describe.serial("Radio Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("worship organization only sees worship sources", async ({
    page,
    e2eCommand,
    projectPage,
  }) => {
    await e2eCommand.login({
      username: "testuser_church",
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

    await projectPage.createPlugin("Radio");

    await expect(page.getByText("Worship Radio 247")).toBeVisible();
    await expect(page.getByText("AllWorship Christmas Worship")).toBeVisible();
    await expect(page.getByText("BBC World Service")).not.toBeVisible();
  });

  test("venue organization sees a wider variety of radio stations", async ({
    page,
    e2eCommand,
    projectPage,
  }) => {
    await e2eCommand.login({
      username: "testuser_venue",
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

    await projectPage.createPlugin("Radio");

    await expect(page.getByText("BBC World Service")).toBeVisible();
    await expect(page.getByText("Radio Paradise (Eclectic Mix)")).toBeVisible();
    await expect(page.getByText("SomaFM Groove Salad")).toBeVisible();
    await expect(page.getByText("Worship Radio 247")).not.toBeVisible();
  });
});