import { expect, test } from "../../fixtures/organizationFixture";

test.describe("OrganizationPage", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can create a new project", async ({
    page,
    organizationPage,
    e2eCommand,
  }) => {
    await e2eCommand.login({
      orgs: [["TestOrg", "testorg"]],
      next: "/o/testorg",
    });

    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    await organizationPage.newProjectButton.click();
    await organizationPage.newProjectSaveButton.click();

    await expect(page).toHaveURL(/app\/testorg/);
  });
});
