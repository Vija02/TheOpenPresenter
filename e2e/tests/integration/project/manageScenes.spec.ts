import { type Page } from "@playwright/test";

import { expect, test } from "../../../fixtures/screenFixture";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-scenes-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Scenes ${WORKER_TAG}`;
const USERNAME = `testuser_scenes_${WORKER_TAG}`;
const PROJECT_NAME = "Sunday Service";
const PROJECT_SLUG = "sunday-service";

const emptyScene = (name: string) => ({
  name,
  pluginName: "lyrics-presenter",
  pluginData: { songs: [], looks: {} },
});

const login = (e2eCommand: any) =>
  e2eCommand.login({
    username: USERNAME,
    orgs: [
      {
        name: ORG_NAME,
        slug: ORG_SLUG,
        owner: true,
        projects: [
          {
            name: PROJECT_NAME,
            slug: PROJECT_SLUG,
            scenes: [
              emptyScene("Welcome"),
              emptyScene("Worship"),
              emptyScene("Sermon"),
            ],
          },
        ],
      },
    ],
  });

test.describe("Manage scenes", () => {
  test.beforeEach(async ({ e2eCommand, page }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
    // The section header and its actions are on the desktop sidebar
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  const sidebarSceneNames = (page: Page) =>
    page
      .locator(".rt--sidebar-web-scene-item:not(.rt--sidebar-web-scene-add) p")
      .allTextContents();

  test("names the scene list after the project", async ({
    page,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    await expect(
      page.getByRole("button", { name: PROJECT_NAME, exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("adds a scene from the section header", async ({ page, e2eCommand }) => {
    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    // Header actions only show while the section is hovered
    await page.getByTestId("scenes-section").hover();
    await page.getByRole("button", { name: "Add scene" }).click();
    await expect(page).toHaveURL(/\/new/);
  });

  test("jumps to adding a scene from the modal", async ({
    page,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    await page.getByTestId("scenes-section").hover();
    await page.getByRole("button", { name: "Manage scenes" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add scene" })
      .click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/new/);
  });

  test("renames, reorders and deletes scenes", async ({ page, e2eCommand }) => {
    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await expect
      .poll(() => sidebarSceneNames(page))
      .toEqual(["Welcome", "Worship", "Sermon"]);

    await page.getByTestId("scenes-section").hover();
    await page.getByRole("button", { name: "Manage scenes" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("manage-scenes-row")).toHaveCount(3);

    // Rename: saved when leaving the field
    const nameInputs = dialog.getByRole("textbox", { name: "Scene name" });
    await nameInputs.nth(0).fill("Announcements");
    await nameInputs.nth(0).press("Enter");
    await expect
      .poll(() => sidebarSceneNames(page))
      .toEqual(["Announcements", "Worship", "Sermon"]);

    // Drag Sermon by its grip to the top
    const grip = await dialog
      .getByRole("button", { name: "Reorder Sermon" })
      .boundingBox();
    const top = await dialog
      .getByTestId("manage-scenes-row")
      .first()
      .boundingBox();
    if (!grip || !top) throw new Error("Scene row has no bounding box");
    const x = grip.x + grip.width / 2;
    await page.mouse.move(x, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, top.y + top.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect
      .poll(() => sidebarSceneNames(page))
      .toEqual(["Sermon", "Announcements", "Worship"]);

    // Delete, after confirming
    await dialog.getByRole("button", { name: "Delete Worship" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog.getByTestId("manage-scenes-row")).toHaveCount(2);
    await expect
      .poll(() => sidebarSceneNames(page))
      .toEqual(["Sermon", "Announcements"]);
  });
});
