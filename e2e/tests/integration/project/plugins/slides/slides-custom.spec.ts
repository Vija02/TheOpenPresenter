import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";

/**
 * Custom (in-app authored) slides for the Slides plugin.
 *
 * These slides are `@repo/layout` documents rather than uploaded files: there
 * is no image to wait on, each slide renders live through `LayoutRenderer` in
 * both the remote grid and the editor. The editor (LayoutWorkbench) is the same
 * surface the Bible plugin's "Slide Template" dialog exercises, so this spec
 * only covers the slides-plugin-specific shell around it: creating a deck,
 * managing the filmstrip, and how a deck shows up in the grid and Settings.
 */

const EDITOR = { name: "Edit slides" };

/** The layout editor canvas inside the "Edit slides" dialog. */
const editorDialog = (page: Page) => page.getByRole("dialog", EDITOR);

/** A rendered element in a layout document, by its stable preset id. */
const layElement = (scope: Page | Locator, id: string) =>
  scope.locator(`[data-lay-id="${id}"]`);

/** Grid slide cards, in order. */
const slideCards = (page: Page) => page.getByTestId("slide-container");

/**
 * A grid slide card by its heading. Custom slides render their own text through
 * the LayoutRenderer, so the card's concatenated text is no longer just its
 * heading — match the heading text node instead of the whole container.
 */
const slideCardByHeading = (page: Page, heading: string | RegExp) =>
  slideCards(page).filter({
    has: page.getByText(heading, { exact: true }),
  });

const filmstrip = (page: Page) => page.getByTestId("custom-slide-filmstrip");

/** One filmstrip thumbnail (each is a bordered card holding a preview + row). */
const filmstripSlides = (page: Page) => filmstrip(page).locator("> div");

test.describe.serial("Slides Plugin - custom slides", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("creates a deck from the empty state and it appears in the grid", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    // Empty state: the Landing "Create slides from scratch" card.
    await expect(page.getByRole("heading")).toContainText("Upload your slides");
    await page.getByTestId("slides-create-from-scratch").click();

    // The editor opens on the deck's first slide, which is the default
    // "Title & body" starter — so its title and body elements are present.
    const dialog = editorDialog(page);
    await expect(dialog).toBeVisible();
    await expect(layElement(dialog, "title")).toBeVisible();
    await expect(layElement(dialog, "body")).toBeVisible();

    // Close and confirm the deck rendered one slide into the grid, via the
    // layout renderer rather than an <img>.
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();

    // The grid renders through the plain LayoutRenderer (no editor
    // `data-lay-id` wrappers), so assert on the rendered text nodes instead.
    const firstSlide = slideCardByHeading(page, "Slide 1");
    await expect(firstSlide).toBeVisible();
    await expect(
      firstSlide.locator(".lay--text-content").first(),
    ).toBeVisible();
  });

  test("adds slides from the filmstrip and they show up in the grid", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");
    await page.getByTestId("slides-create-from-scratch").click();

    const dialog = editorDialog(page);
    await expect(dialog).toBeVisible();

    // One starter slide to begin with.
    await expect(filmstripSlides(page)).toHaveCount(1);

    // Add two more through the filmstrip's own "Add slide" button.
    await filmstrip(page).getByRole("button", { name: "Add slide" }).click();
    await expect(filmstripSlides(page)).toHaveCount(2);
    await filmstrip(page).getByRole("button", { name: "Add slide" }).click();
    await expect(filmstripSlides(page)).toHaveCount(3);

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();

    // Three custom slides now render in the grid (plus the trailing Add/Import
    // tiles, so filter to the ones that carry a slide heading).
    await expect(slideCardByHeading(page, /^Slide [123]$/)).toHaveCount(3);
  });

  test("editing a slide's text is reflected in the grid", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");
    await page.getByTestId("slides-create-from-scratch").click();

    const dialog = editorDialog(page);
    const title = layElement(dialog, "title");
    await expect(title).toBeVisible();

    // Double-click to edit in place, replace the placeholder, commit by
    // clicking the empty canvas gutter.
    await title.dblclick();
    await expect(title).toHaveClass(/lay--editor-item--editing/);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("Hello World");
    await dialog
      .locator(".lay--workbench-canvas")
      .click({ position: { x: 5, y: 5 } });
    await expect(title).not.toHaveClass(/lay--editor-item--editing/);

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();

    // The edit reaches the live grid render.
    const firstSlide = slideCardByHeading(page, "Slide 1");
    await expect(firstSlide.getByText("Hello World")).toBeVisible();
  });

  test("deleting the last slide removes the whole deck", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");
    await page.getByTestId("slides-create-from-scratch").click();

    const dialog = editorDialog(page);
    await expect(filmstripSlides(page)).toHaveCount(1);

    // Delete the only slide: the deck has nothing left, so the editor closes
    // and the grid returns to the empty state.
    await filmstrip(page).getByRole("button", { name: "Delete slide" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading")).toContainText("Upload your slides");
  });

  test("Settings offers Edit (not Replace) for a custom deck, and it opens the editor", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");
    await page.getByTestId("slides-create-from-scratch").click();

    const dialog = editorDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Settings" }).click();

    // A custom deck cannot be "replaced" with a file — it is edited in place.
    await expect(page.getByRole("button", { name: "Replace" })).toHaveCount(0);

    await page.getByRole("button", { name: "Edit", exact: true }).click();

    // Settings closes and the slide editor opens.
    await expect(editorDialog(page)).toBeVisible();
    await expect(layElement(editorDialog(page), "title")).toBeVisible();
  });
});
