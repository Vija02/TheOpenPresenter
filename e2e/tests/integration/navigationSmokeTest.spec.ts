import { expect, test } from "../../fixtures/organizationFixture";

test.describe("NavigationSmokeTest", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can access all pages without error", async ({
    page,
    loginDefault,
    e2eCommand,
  }) => {
    await loginDefault();

    await expect(page).toHaveURL(/o\/testorg/);

    await page
      .getByRole("button", { name: "Back to organization overview" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your Organizations" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Create new" }).click();
    await expect(
      page.getByRole("heading", { name: "Create organization" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Join existing" }).click();
    await expect(
      page.getByRole("heading", { name: "Join organization" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Profile Settings" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Password" }).click();
    await expect(
      page.getByRole("heading", { name: "Change Password" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Emails" }).click();
    await expect(
      page.getByRole("heading", { name: "Email Addresses" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Delete Account" }).click();
    await expect(page.getByText("deletion")).toBeInViewport();

    await page.getByRole("link", { name: "Organizations" }).click();
    await page.getByRole("link", { name: "TestOrg" }).click();
    await expect(
      page.getByRole("heading", { name: "Projects" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "General Settings" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Tags" }).click();
    await expect(
      page.getByRole("heading", { name: "Tags", exact: true }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Categories" }).click();
    await expect(
      page.getByRole("heading", { name: "Categories" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Members" }).click();
    await expect(
      page.getByRole("heading", { name: "Members" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Leave Organization" }).click();
    await expect(
      page.getByRole("heading", { name: "Leave Organization?" }),
    ).toBeInViewport();

    await page.getByRole("link", { name: "Delete Organization" }).click();
    await expect(
      page.getByRole("heading", { name: "Delete Organization?" }),
    ).toBeInViewport();
  });
});
