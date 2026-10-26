import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import { ORG_SLUG, projectUrl } from "../../../../../helpers/workerData";
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
  await expect(
    projectPage.page.getByText("Add a passage to get started"),
  ).toBeVisible();
};

/**
 * Adds a passage from the search bar. A just-chosen translation loads its book
 * index in the background and Add refuses until it has, so retry while the
 * app says it is still loading.
 */
const addPassage = async (page: Page, reference: string) => {
  await page.getByTestId("bible-search-input").fill(reference);
  await expect(async () => {
    await page.getByTestId("bible-search-add").click();
    await expect(page.getByText(/Loading translation/)).toBeHidden({
      timeout: 1000,
    });
  }).toPass();
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

test.describe("Bible Plugin", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("can add a verse by reference", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });

    await addPassage(page, "John 3:16");

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
    await expect(
      presentedPage
        .getByTestId("current-scene")
        .getByText("For God so loved the world"),
    ).toBeVisible();
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

  test("can move passages up and down and delete them", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });

    await addPassage(page, "John 3:16");
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "For God so loved the world",
    );

    await addPassage(page, "John 3:17");

    const passages = page.getByTestId("slide-container");
    await expect(passages.first()).toContainText("John 3:16");
    await expect(passages.nth(1)).toContainText("John 3:17");

    await page.getByRole("button", { name: "Move down" }).first().click();

    await expect(passages.first()).toContainText("John 3:17");
    await expect(passages.nth(1)).toContainText("John 3:16");

    await page.getByRole("button", { name: "Move up" }).nth(1).click();

    await expect(passages.first()).toContainText("John 3:16");
    await expect(passages.nth(1)).toContainText("John 3:17");

    await page.getByTestId("bible-remove-passage").first().click();
    await expect(
      page.getByText("Are you sure you want to remove this passage?"),
    ).toBeVisible();
    await page.getByTestId("popconfirm-confirm").click();

    await expect(passages).toHaveCount(1);
    await expect(passages.first()).toContainText("John 3:17");
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

    await addPassage(page, "John 3:16");

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

    await addPassage(page, "John 3:16");

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
    // The search is debounced and its results replace the whole list, rows
    // included. The row is already visible from the unfiltered list, so
    // without this the upload dialog opens from a row that is then swapped
    // out, taking the dialog with it.
    await expect(
      settings.getByText(/^Showing 1 of 1 matching translations/),
    ).toBeVisible();
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

    await addPassage(page, "John 3:16");

    await expect(page.getByText("John 3:16").first()).toBeVisible();
    await expect(page.getByText(catalogName).first()).toBeVisible();
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "E2E custom translation verse text",
    );
  });

  test("a saved template is used by the next Bible scene", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupBiblePlugin({ loginAndGoToProject, projectPage });
    // Tells this scene apart from the next one
    await addPassage(page, "John 3:16");
    await expect(page.getByTestId("slide-container").first()).toContainText(
      "For God so loved the world",
    );

    await page.getByRole("button", { name: "Style" }).click();
    const dialog = page.getByRole("dialog", { name: "Slide Template" });
    await expect(dialog.locator(".lay--editor-surface")).toBeVisible();
    await dialog.getByRole("button", { name: "Add text" }).click();
    await expect(dialog.locator('[data-lay-id="text-1"]')).toBeVisible();

    const templateSaved = page.waitForResponse(
      (res) => res.url().includes("bible.template.save") && res.ok(),
    );
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await templateSaved;

    // The first scene is also called "Bible", so pick from the creator itself
    await projectPage.newSceneButton.click({ force: true });
    await projectPage.sceneCreatorOption("Bible").click();
    await expect(page.getByText("Add a passage to get started")).toBeVisible();

    await page.getByRole("button", { name: "Style" }).click();
    const reopened = page.getByRole("dialog", { name: "Slide Template" });
    await expect(reopened.locator(".lay--editor-surface")).toBeVisible();
    await expect(reopened.locator('[data-lay-id="text-1"]')).toContainText(
      "Your text here",
    );
  });
});

// A public-link viewer (the logged-out demo lands on one) has no session. The
// public catalog and passage lookups must still work for them.
test.describe("Bible Plugin - public access", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.clearWorkerData();

    await e2eCommand.loginWithScenes({
      orgs: [
        {
          name: "TestOrg",
          slug: ORG_SLUG,
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              isPublic: true,
              scenes: [
                {
                  pluginName: "bible",
                  name: "Bible",
                  activate: true,
                  pluginData: { passages: [] },
                  rendererPluginData: {
                    passageId: null,
                    slideIndex: null,
                    lastClickTimestamp: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("a logged-out viewer can add a verse and browse the catalog", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(projectUrl());
      await expect(
        page.getByText("Add a passage to get started"),
      ).toBeVisible();

      await addPassage(page, "John 3:16");
      await expect(page.getByTestId("slide-container").first()).toContainText(
        "For God so loved the world",
      );

      await page.getByTestId("bible-settings").click();
      const settings = page.getByRole("dialog", { name: "Bible Settings" });
      await expect(
        settings
          .getByTestId("bible-translation-row")
          .filter({ hasText: "King James (Authorized) Version" })
          .first(),
      ).toBeVisible();
      await expect(settings.getByTestId("bible-catalog-error")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("a logged-out viewer can't upload, but their settings stick to the scene", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(projectUrl());
      await expect(
        page.getByText("Add a passage to get started"),
      ).toBeVisible();

      await page.getByTestId("bible-settings").click();
      const settings = page.getByRole("dialog", { name: "Bible Settings" });
      await expect(settings).toBeVisible();
      await expect(
        settings.getByRole("button", { name: "Add translation" }),
      ).toHaveCount(0);

      // Copyrighted entries can't be attached without an organization
      await settings
        .getByPlaceholder("Search by name or abbreviation...")
        .fill("hcsb");
      await expect(
        settings.getByText(/^Showing 1 of 1 matching translations/),
      ).toBeVisible();
      await expect(
        settings
          .getByTestId("bible-translation-row")
          .filter({ hasText: "English HCSB 2004" })
          .getByRole("button", { name: "Upload" }),
      ).toBeDisabled();

      await settings
        .getByPlaceholder("Search by name or abbreviation...")
        .fill("world english bible");
      await settings.getByRole("button", { name: "Ready to use" }).click();
      const webRow = settings
        .getByTestId("bible-translation-row")
        .filter({ hasText: "World English Bible · WEB" });
      await webRow.getByRole("button", { name: "Use" }).click();
      await settings.getByRole("button", { name: "Save" }).click();
      await expect(settings).toBeHidden();

      await addPassage(page, "John 3:16");
      await expect(page.getByTestId("slide-container").first()).toContainText(
        "his only born Son",
      );

      // Kept on the scene, so it survives a reload
      await page.reload();
      await page.getByTestId("bible-settings").click();
      await expect(
        settings
          .getByTestId("bible-translation-row")
          .filter({ hasText: "World English Bible · WEB" })
          .getByText("Primary", { exact: true }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
