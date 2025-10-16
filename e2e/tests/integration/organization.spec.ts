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
    loginDefault,
  }) => {
    await loginDefault();

    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    await organizationPage.newProjectButton.click();
    await organizationPage.newProjectSaveButton.click();

    await expect(page).toHaveURL(/app\/testorg/);
  });

  test("can import a new project", async ({
    page,
    organizationPage,
    loginDefault,
  }) => {
    await loginDefault();

    await organizationPage.importButton.click();

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "choose file" }).click(),
    ]);
    await fileChooser.setFiles("./dummyFiles/dummyProject.top");

    await expect(page.getByText("Import Complete")).toBeInViewport();

    await organizationPage.importCloseButton.click();

    await expect(page.getByText("Test Import Project")).toBeInViewport();
  });

  test("can edit and delete project", async ({
    page,
    organizationPage,
    loginWithDefaultProject,
  }) => {
    await loginWithDefaultProject();

    await organizationPage.projectCardEditButtonNth(0).click();
    await organizationPage.projectEditModalNameInput.click();
    await organizationPage.projectEditModalNameInput.fill("Test Project Name");

    await organizationPage.projectEditModalCategoryInput.click();
    await organizationPage
      .projectEditModalCategoryOption("Sunday Morning")
      .click();

    await organizationPage.projectEditModalSaveButton.click();

    await expect(page.getByText("Test Project Name")).toBeInViewport();
    await expect(page.getByText("Sunday Morning")).toBeInViewport();

    await organizationPage.projectCardDeleteButtonNth(0).click();
    await page.getByTestId("popconfirm-confirm").click();

    await expect(page.getByText("Test Project Name")).not.toBeInViewport();
  });
});
