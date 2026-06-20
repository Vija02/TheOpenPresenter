import { expect, test } from "../../../../../fixtures/projectFixture";

test.describe("Slides Plugin - Multiple Imports", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can add multiple imports and both render correctly", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Slides");

    const renderedSlides = page
      .getByTestId("slide-container")
      .filter({ has: page.locator("img") });

    // --- Upload first import (PDF) from the Landing ---
    await page.getByText("PDF", { exact: true }).click();
    await page
      .getByTestId("media-picker-upload-button")
      .or(page.getByTestId("media-picker-upload-card"))
      .click();
    await uppyUploadFile("./dummyFiles/dummySlide.pdf");

    // Wait until the first import has been processed
    await expect(renderedSlides.first()).toBeVisible({ timeout: 20 * 1000 });
    const slidesAfterFirst = await renderedSlides.count();
    expect(slidesAfterFirst).toBeGreaterThan(0);

    // --- Upload second import (PPTX) via the "Add slide" Slide ---
    await page.getByText("Add slide", { exact: true }).click();
    await page.getByText("Powerpoint", { exact: true }).click();
    await page
      .getByTestId("media-picker-upload-button")
      .or(page.getByTestId("media-picker-upload-card"))
      .click();
    await uppyUploadFile("./dummyFiles/dummySlide.pptx");

    // Wait until the PPTX has finished processing and added more slides
    await expect
      .poll(async () => renderedSlides.count(), { timeout: 30 * 1000 })
      .toBeGreaterThan(slidesAfterFirst);

    const slidesAfterSecond = await renderedSlides.count();
    const pptxSlideCount = slidesAfterSecond - slidesAfterFirst;
    expect(pptxSlideCount).toBeGreaterThan(0);

    // Both imports should have all their slides rendered with images. Check
    // the boundary slides (last PDF, first/last PPTX) explicitly.
    await expect(
      page
        .getByTestId("slide-container")
        .nth(slidesAfterFirst - 1)
        .getByRole("img"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("slide-container")
        .nth(slidesAfterFirst)
        .getByRole("img"),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("slide-container")
        .nth(slidesAfterSecond - 1)
        .getByRole("img"),
    ).toBeVisible();

    // The trailing "Add slide" placeholder is still there after both imports
    await expect(page.locator("slides-remote").getByText("Add slide", { exact: true })).toBeVisible();

    // --- Visually verify both imports render correctly on the present page ---

    // Last slide of the first import (PDF)
    const lastFirstImportIdx = slidesAfterFirst - 1;
    await page.getByTestId("slide-container").nth(lastFirstImportIdx).click();

    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");
    await expect(presentedPage.locator("img").first()).toBeVisible({
      timeout: 10 * 1000,
    });
    await expect(presentedPage).toHaveScreenshot("last-slide-first-import.png");

    await page.getByTestId("slide-container").nth(slidesAfterFirst).click();
    await presentedPage.waitForLoadState("networkidle");
    await expect(presentedPage).toHaveScreenshot(
      "first-slide-second-import.png",
    );
  });

  test("can delete an import and currentSlideIndex follows the surviving slide", async ({
    page,
    context,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Slides");

    const renderedSlides = page
      .getByTestId("slide-container")
      .filter({ has: page.locator("img") });

    // --- Upload first import (PDF) ---
    await page.getByText("PDF", { exact: true }).click();
    await page
      .getByTestId("media-picker-upload-button")
      .or(page.getByTestId("media-picker-upload-card"))
      .click();
    await uppyUploadFile("./dummyFiles/dummySlide.pdf");

    await expect(renderedSlides.first()).toBeVisible({ timeout: 20 * 1000 });
    const slidesAfterFirst = await renderedSlides.count();
    expect(slidesAfterFirst).toBeGreaterThan(0);

    // --- Upload second import (PPTX) ---
    await page.getByText("Add slide", { exact: true }).click();
    await page.getByText("Powerpoint", { exact: true }).click();
    await page
      .getByTestId("media-picker-upload-button")
      .or(page.getByTestId("media-picker-upload-card"))
      .click();
    await uppyUploadFile("./dummyFiles/dummySlide.pptx");

    await expect
      .poll(async () => renderedSlides.count(), { timeout: 30 * 1000 })
      .toBeGreaterThan(slidesAfterFirst);

    const slidesAfterSecond = await renderedSlides.count();
    const pptxSlideCount = slidesAfterSecond - slidesAfterFirst;
    expect(pptxSlideCount).toBeGreaterThan(0);

    // --- Verify the PDF media exists BEFORE deletion ---
    const mediaPageBefore = await context.newPage();
    await mediaPageBefore.goto("/o/testorg/media");
    await expect(
      mediaPageBefore.getByRole("heading", {
        name: "Media Library",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      mediaPageBefore.getByText("dummySlide.pdf").first(),
    ).toBeVisible();
    await expect(
      mediaPageBefore.getByText("dummySlide.pptx").first(),
    ).toBeVisible();
    await mediaPageBefore.close();

    // --- Select the first slide of the SECOND import ---
    const targetSlideBefore = page
      .getByTestId("slide-container")
      .nth(slidesAfterFirst);

    await targetSlideBefore.click();
    await expect(targetSlideBefore).toHaveAttribute("aria-current", "true");

    // --- Delete the first import (PDF) via the Settings modal ---
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByTestId("popconfirm-confirm").click();
    await page.getByRole("button", { name: "Close" }).first().click();

    // --- After deletion ---

    // Total slides should now equal the PPTX import only
    await expect
      .poll(async () => renderedSlides.count(), { timeout: 10 * 1000 })
      .toBe(pptxSlideCount);

    // Index should be moved to 0
    await expect(page.getByTestId("slide-container").nth(0)).toHaveAttribute(
      "aria-current",
      "true",
    );

    // --- Verify the PDF media was deleted from the media library ---
    const mediaPageAfter = await context.newPage();
    await mediaPageAfter.goto("/o/testorg/media");
    await expect(
      mediaPageAfter.getByRole("heading", {
        name: "Media Library",
        exact: true,
      }),
    ).toBeVisible();

    await expect(mediaPageAfter.getByText("dummySlide.pdf")).toHaveCount(0);

    await expect(
      mediaPageAfter.getByText("dummySlide.pptx").first(),
    ).toBeVisible();
    await mediaPageAfter.close();
  });
});
