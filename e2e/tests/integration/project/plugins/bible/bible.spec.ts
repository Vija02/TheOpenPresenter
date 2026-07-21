import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import type { ProjectPage } from "../../../../../pages/ProjectPage";

type SetupBiblePluginArgs = {
  loginAndGoToProject: () => Promise<void> | void;
  projectPage: ProjectPage;
};

const setupBiblePlugin = async ({
  loginAndGoToProject,
  projectPage,
}: SetupBiblePluginArgs) => {
  await loginAndGoToProject();
  await projectPage.createPlugin("Bible");
  await expect(projectPage.page.getByText("No passages yet")).toBeVisible();
};

const selectTranslation = async (projectPage: ProjectPage, name: string) => {
  const settings = projectPage.page.getByRole("dialog", {
    name: "Bible Settings",
  });
  await settings
    .getByTestId("bible-translation-row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Use" })
    .click();
};

const attachTranslationToCatalog = async (page: Page, name: string) => {
  const settings = page.getByRole("dialog", { name: "Bible Settings" });
  await settings
    .getByTestId("bible-translation-row")
    .filter({ hasText: name })
    .getByRole("button", { name: "Upload" })
    .click();

  const uploadDialog = page.getByRole("dialog", {
    name: `Upload ${name}`,
  });
  await expect(uploadDialog).toBeVisible();

  await uploadDialog
    .locator('input[type="file"]')
    .setInputFiles("./dummyFiles/bible-test-translation.xml");
};

test.describe.serial("Bible Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
        e2eCommand.serverCommand("clearBibleData"),
      ]),
  );

  test("can add a verse by reference", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });

    await page.getByTestId("bible-search-input").fill("John 3:16");
    await page.getByTestId("bible-search-add").click();

    await expect(page.getByText("John 3:16").first()).toBeVisible();
    await expect(
      page.getByText("King James (Authorized) Version").first(),
    ).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "For God so loved the world",
    );
    await page.getByTestId("slide-container").first().click();

    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");
    await expect(presentedPage).toHaveScreenshot();
  });

  test("can browse and add a verse range", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });

    await page.getByTestId("bible-browse").click();
    const picker = page.getByRole("dialog", {
      name: /King James \(Authorized\) Version/,
    });
    await picker.getByRole("button", { name: "John", exact: true }).click();
    await picker.getByRole("button", { name: "3", exact: true }).click();
    await picker.getByRole("button", { name: "16", exact: true }).click();
    await picker.getByRole("button", { name: "17", exact: true }).click();
    await picker.getByTestId("bible-picker-add").click();

    await expect(page.getByText("John 3:16-17").first()).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "For God so loved the world",
    );
    await expect(page.getByTestId("slide-container").nth(1)).toContainText(
      "For God sent not his Son",
    );
  });

  test("can filter translations by language and use a different translation", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });

    await page.getByTestId("bible-settings").click();
    const settings = page.getByRole("dialog", { name: "Bible Settings" });
    await expect(settings).toBeVisible();

    await settings.getByText("English", { exact: true }).click();
    await settings.getByRole("combobox").fill("Indonesian");
    await settings.getByRole("combobox").press("Enter");
    await expect(
      settings.getByText("Indonesian", { exact: true }),
    ).toBeVisible();
    await settings.getByRole("button", { name: "Ready to use" }).click();
    await settings
      .getByPlaceholder("Search by name or abbreviation...")
      .fill("terjemahan baru");

    await expect(
      settings.getByText("Indonesian (Alkitab Terjemahan Baru)"),
    ).toBeHidden();
    await settings.getByRole("button", { name: "All", exact: true }).click();
    await expect(
      settings.getByText("Indonesian (Alkitab Terjemahan Baru)"),
    ).toBeVisible();
    await settings.getByRole("button", { name: "Remove Indonesian" }).click();
    await settings
      .getByPlaceholder("Search by name or abbreviation...")
      .fill("world english bible");
    await settings.getByRole("button", { name: "Ready to use" }).click();
    await expect(settings.getByText("World English Bible · WEB")).toBeVisible();
    await selectTranslation(projectPage, "World English Bible · WEB");
    await settings.getByRole("button", { name: "Save" }).click();

    await expect(settings).toBeHidden();

    await page.getByTestId("bible-search-input").fill("John 3:16");
    await page.getByTestId("bible-search-add").click();

    await expect(page.getByText("John 3:16").first()).toBeVisible();
    await expect(page.getByText("World English Bible").first()).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "his only born Son",
    );
  });

  test("can upload and use a custom translation", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });

    await page.getByTestId("bible-settings").click();
    await page.getByRole("button", { name: "Add translation" }).click();

    const uploadDialog = page.getByRole("dialog", {
      name: "Your Translations",
    });
    await expect(uploadDialog).toBeVisible();
    await expect(
      uploadDialog.getByText("No translations uploaded yet."),
    ).toBeVisible();

    await uploadDialog
      .locator('input[type="file"]')
      .setInputFiles("./dummyFiles/bible-test-translation.xml");

    await expect(
      uploadDialog.getByText('Added "E2E Test Bible"'),
    ).toBeVisible();
    await expect(
      uploadDialog.getByText("E2E Test Bible").first(),
    ).toBeVisible();
    await uploadDialog.getByRole("button", { name: "Close" }).first().click();

    const settings = page.getByRole("dialog", { name: "Bible Settings" });
    await settings
      .getByPlaceholder("Search by name or abbreviation...")
      .fill("e2e test bible");
    await expect(settings.getByText("E2E Test Bible")).toBeVisible();
    await selectTranslation(projectPage, "E2E Test Bible");
    await settings.getByRole("button", { name: "Save" }).click();
    await expect(settings).toBeHidden();

    await page.getByTestId("bible-search-input").fill("John 3:16");
    await page.getByTestId("bible-search-add").click();

    await expect(page.getByText("John 3:16").first()).toBeVisible();
    await expect(page.getByText("E2E Test Bible").first()).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "E2E custom translation verse text",
    );
  });

  test("can attach and use a catalog translation", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });

    await page.getByTestId("bible-settings").click();
    const settings = page.getByRole("dialog", { name: "Bible Settings" });
    await expect(settings).toBeVisible();

    await settings
      .getByPlaceholder("Search by name or abbreviation...")
      .fill("hcsb");
    const catalogName = "English HCSB 2004 - Copyrighted Only For Website";
    await expect(settings.getByText(catalogName)).toBeVisible();

    await attachTranslationToCatalog(page, catalogName);

    await expect(
      settings
        .getByTestId("bible-translation-row")
        .filter({ hasText: catalogName })
        .getByText("Uploaded"),
    ).toBeVisible();

    await selectTranslation(projectPage, catalogName);
    await settings.getByRole("button", { name: "Save" }).click();
    await expect(settings).toBeHidden();

    await page.getByTestId("bible-search-input").fill("John 3:16");
    await page.getByTestId("bible-search-add").click();

    await expect(page.getByText("John 3:16").first()).toBeVisible();
    await expect(page.getByText(catalogName).first()).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "E2E custom translation verse text",
    );
  });
});
