import { expect, test } from "../../fixtures/organizationFixture";

test.describe("OrgSwitcher", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can switch between organizations from the sidebar", async ({
    page,
    e2eCommand,
  }) => {
    await e2eCommand.login({
      orgs: [
        { name: "TestOrg", slug: "testorg" },
        { name: "TestOrg Two", slug: "testorg-two" },
      ],
      next: "/o/testorg",
    });

    await expect(page).toHaveURL(/o\/testorg(\?|$|\/)/);

    // Open the switcher popover
    const switcherTrigger = page.getByRole("button", {
      name: "Switch organization",
    });
    await switcherTrigger.click();

    await expect(page.getByText("Switch organization")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /TestOrg$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /TestOrg Two$/ }),
    ).toBeVisible();

    // Navigate to the second org
    await page.getByRole("link", { name: /TestOrg Two$/ }).click();

    // URL switches and the projects page for the new org renders
    await expect(page).toHaveURL(/o\/testorg-two(\?|$|\/)/);
    await expect(
      page.getByRole("heading", { name: "Projects" }),
    ).toBeInViewport();

    // The trigger now displays the new org name
    await expect(switcherTrigger).toContainText("TestOrg Two");
  });

  test("View all organizations link navigates to the org overview", async ({
    page,
    loginDefault,
  }) => {
    await loginDefault();

    await expect(page).toHaveURL(/o\/testorg(\?|$|\/)/);

    await page.getByRole("button", { name: "Switch organization" }).click();

    await page.getByRole("link", { name: "View all organizations" }).click();

    await expect(
      page.getByRole("heading", { name: "Your Organizations" }),
    ).toBeInViewport();
  });
});
