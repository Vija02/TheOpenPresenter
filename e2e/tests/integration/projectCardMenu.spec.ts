import { expect, test } from "../../fixtures/organizationFixture";

test.describe("Project card menu", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("duplicates with the default name", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject();

    await expect(organizationPage.projectCards).toHaveCount(1);

    await organizationPage.projectCardMenuButtonNth(0).click();
    await organizationPage.projectCardMenuDuplicate.click();

    await expect(organizationPage.duplicateModalNameInput).toHaveValue(
      "TestProject (copy)",
    );
    await organizationPage.duplicateModalConfirmButton.click();

    await expect(page.getByText("TestProject (copy)")).toBeVisible();
    await expect(organizationPage.projectCards).toHaveCount(2);
  });

  test("duplicates with a chosen name", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject();

    await organizationPage.projectCardMenuButtonNth(0).click();
    await organizationPage.projectCardMenuDuplicate.click();

    await organizationPage.duplicateModalNameInput.fill("Second Service");
    await organizationPage.duplicateModalConfirmButton.click();

    await expect(page.getByText("Second Service")).toBeVisible();
    await expect(page.getByText("TestProject (copy)")).toBeHidden();
    await expect(organizationPage.projectCards).toHaveCount(2);
  });

  test("menu holds the renderer link", async ({
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject();

    await organizationPage.projectCardMenuButtonNth(0).click();

    await expect(organizationPage.projectCardMenuRenderer).toHaveAttribute(
      "href",
      "/render/testorg/testproject",
    );
  });

  test("can assign a project to a screen", async ({
    page,
    e2eCommand,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject();

    await e2eCommand.serverCommand("setupScreen", {
      orgSlug: "testorg",
      orgName: "TestOrg",
      slug: "testscreen",
      name: "Test Screen",
    });

    await page.reload();

    await organizationPage.projectCardMenuButtonNth(0).click();

    // Screens live behind a submenu so a long list doesn't fill the menu
    await expect(
      organizationPage.projectCardMenuScreen("Test Screen"),
    ).toBeHidden();
    await organizationPage.projectCardMenuAssignToScreen.click();

    await organizationPage.projectCardMenuScreen("Test Screen").click();

    await expect(page.getByText("Project assigned to screen")).toBeVisible();

    // Reload rather than reopening against the live refetch, which swaps the
    // card out mid-click. This also proves the assignment persisted.
    await page.reload();

    await organizationPage.projectCardMenuButtonNth(0).click();
    await organizationPage.projectCardMenuAssignToScreen.click();
    await expect(
      page.getByText("Currently showing this project"),
    ).toBeVisible();
  });
});
