import { expect, test } from "../../../fixtures/cloudFixture";
import { OrgSettingCategoriesPage } from "../../../pages/OrgSettings/OrgSettingCategoriesPage";
import { OrgSettingTagsPage } from "../../../pages/OrgSettings/OrgSettingTagsPage";
import { OrganizationPage } from "../../../pages/OrganizationPage";

test.describe("Cloud Sync", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("sync project metadata properly", async ({
    context,
    page,
    cloudPage,
    loginWithCloudProjects,
  }) => {
    test.slow();
    await loginWithCloudProjects("/o/testorg/cloud");

    const pagePromises: Promise<any>[] = [];
    const cloudOrganizationPage = new OrganizationPage(await context.newPage());
    pagePromises.push(cloudOrganizationPage.page.goto("/o/testsyncorg"));
    const cloudTagPage = new OrgSettingTagsPage(await context.newPage());
    pagePromises.push(cloudTagPage.page.goto("/o/testsyncorg/settings/tags"));
    const cloudCategoryPage = new OrgSettingCategoriesPage(
      await context.newPage(),
    );
    pagePromises.push(
      cloudCategoryPage.page.goto("/o/testsyncorg/settings/categories"),
    );

    await cloudPage.hostInput.clear();
    await cloudPage.hostInput.fill("http://localhost:5678");

    const popupPromise = page.waitForEvent("popup");
    await cloudPage.connectToCloudButton.click();

    const popup = await popupPromise;
    await popup.getByRole("heading", { name: "Login successful" });
    await popup.close();

    await cloudPage.selectOrgButton("testsyncorg").click();

    // Setup done. Now let's start sync
    await cloudPage.startSyncButton.click();

    const currentProjectPage = await context.newPage();
    await currentProjectPage.goto("/o/testorg");

    await expect(currentProjectPage.getByText("SyncProject2")).toBeInViewport();

    // Now let's start making changes
    await Promise.all(pagePromises);

    // 1. It should update basic info
    await cloudOrganizationPage.projectCardEditButtonNth(0).click();
    await cloudOrganizationPage.projectEditModalNameInput.clear();
    await cloudOrganizationPage.projectEditModalNameInput.fill(
      "New edited project name",
    );
    await cloudOrganizationPage.projectEditModalCategoryInput.click();
    await cloudOrganizationPage
      .projectEditModalCategoryOption("Sunday Morning")
      .click();
    await cloudOrganizationPage.projectEditModalSaveButton.click();
    await expect(
      cloudOrganizationPage.projectCards.getByText("Sunday Morning"),
    ).toBeVisible();

    await cloudPage.startSyncButton.click();
    await currentProjectPage.reload({ waitUntil: "domcontentloaded" });

    await expect(
      currentProjectPage.getByText("New edited project name"),
    ).toBeInViewport();
    await expect(
      currentProjectPage.getByText("Sunday Morning"),
    ).toBeInViewport();

    // 2. Should sync new categories and tags
    const createTags = async () => {
      await cloudTagPage.addTagButton.click();
      await cloudTagPage.tagNameInput.fill("Tag 1");
      await cloudTagPage.createButton.click();
      await expect(cloudTagPage.createButton).not.toBeInViewport({
        timeout: 10000,
      });

      await cloudTagPage.addTagButton.click();
      await cloudTagPage.tagNameInput.fill("Tag 2");
      await cloudTagPage.createButton.click();
      await expect(cloudTagPage.createButton).not.toBeInViewport({
        timeout: 10000,
      });
    };

    const createCategories = async () => {
      await cloudCategoryPage.addCategoryButton.click();
      await cloudCategoryPage.categoryNameInput.fill("Category 1");
      await cloudCategoryPage.createCategoryButton.click();
      await expect(cloudCategoryPage.createCategoryButton).not.toBeInViewport({
        timeout: 10000,
      });

      await cloudCategoryPage.addCategoryButton.click();
      await cloudCategoryPage.categoryNameInput.fill("Category 2");
      await cloudCategoryPage.createCategoryButton.click();
      await expect(cloudCategoryPage.createCategoryButton).not.toBeInViewport({
        timeout: 10000,
      });
    };

    await Promise.all([createTags(), createCategories()]);

    await cloudOrganizationPage.page.reload({ waitUntil: "domcontentloaded" });
    await cloudOrganizationPage.projectCardEditButtonNth(0).click();
    await cloudOrganizationPage.projectEditModalCategoryInput.click();
    await cloudOrganizationPage
      .projectEditModalCategoryOption("Category 1")
      .click();
    await cloudOrganizationPage.projectEditModalTagsInput.click();
    await cloudOrganizationPage.projectEditModalTagsOption("Tag 1").click();
    await cloudOrganizationPage.projectEditModalTagsInput.click();
    await cloudOrganizationPage.projectEditModalTagsOption("Tag 2").click();
    await cloudOrganizationPage.projectEditModalSaveButton.click();
    await expect(
      cloudOrganizationPage.projectCards.getByText("Category 1"),
    ).toBeVisible();

    await cloudPage.startSyncButton.click();
    // TODO: Better way to wait until sync is done
    await page.waitForTimeout(3000);
    await currentProjectPage.reload({ waitUntil: "domcontentloaded" });

    await expect(currentProjectPage.getByText("Category 1")).toBeInViewport();
    await expect(currentProjectPage.getByText("Tag 1")).toBeInViewport();
    await expect(currentProjectPage.getByText("Tag 2")).toBeInViewport();

    // 3. Should sync when categories and media deleted
    // Remove category
    await cloudCategoryPage.deleteExistingCategoryButton("Category 1").click();
    await cloudCategoryPage.page.getByTestId("popconfirm-confirm").click();
    await expect(
      cloudCategoryPage.page.getByText("Category 1"),
    ).not.toBeInViewport();
    // Remove tag
    await cloudTagPage.deleteExistingTagButton("Tag 1").click();
    await cloudTagPage.page.getByTestId("popconfirm-confirm").click();
    await expect(cloudTagPage.page.getByText("Tag 1")).not.toBeInViewport();

    // Update the project to remove tag
    await cloudOrganizationPage.page.reload();
    await cloudOrganizationPage.projectCardEditButtonNth(0).click();
    await cloudOrganizationPage.projectEditModalTagsRemove(0).click();
    await cloudOrganizationPage.projectEditModalSaveButton.click();
    await expect(
      cloudOrganizationPage.page.getByText("Tag 2"),
    ).not.toBeInViewport();

    await cloudPage.startSyncButton.click();
    // TODO: Better way to wait until sync is done
    await page.waitForTimeout(3000);
    await currentProjectPage.reload({ waitUntil: "domcontentloaded" });

    await expect(
      currentProjectPage.getByText("Category 1"),
    ).not.toBeInViewport();
    await expect(currentProjectPage.getByText("Tag 1")).not.toBeInViewport();
    await expect(currentProjectPage.getByText("Tag 2")).not.toBeInViewport();
  });
});
