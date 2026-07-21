import { expect, test } from "../../../../../fixtures/projectFixture";

test.describe("Slides Plugin - Replace Import", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("replacing an import keeps surviving slides in position and inserts new slides at the same place", async ({
    page,
    context,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    page.setDefaultTimeout(60000);

    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    const renderedSlides = page
      .getByTestId("slide-container")
      .filter({ has: page.locator("img") });

    const slideAt = (i: number) =>
      page.getByTestId("slide-container").nth(i).locator("img").first();

    // --- Upload import A: dummySlide.pdf (2 pages: A1, A2) ---
    await page.getByText("PDF", { exact: true }).click();
    await uppyUploadFile("./dummyFiles/dummySlide.pdf");

    await expect(renderedSlides.first()).toBeVisible({ timeout: 20 * 1000 });
    await expect
      .poll(async () => renderedSlides.count(), { timeout: 20 * 1000 })
      .toBe(2);

    const oldA1Src = await slideAt(0).getAttribute("src");
    const oldA2Src = await slideAt(1).getAttribute("src");

    // --- Upload import B: dummySlide.pdf again (2 pages: B1, B2) ---
    await page.getByText("Add slide", { exact: true }).click();
    await page.getByText("PDF", { exact: true }).click();
    await uppyUploadFile("./dummyFiles/dummySlide.pdf");

    await expect
      .poll(async () => renderedSlides.count(), { timeout: 30 * 1000 })
      .toBe(4);

    const oldB1Src = await slideAt(2).getAttribute("src");
    const oldB2Src = await slideAt(3).getAttribute("src");

    expect(oldA1Src).not.toBe(oldB1Src);
    expect(oldA2Src).not.toBe(oldB2Src);

    // --- Verify both source PDFs exist in the media library before replace ---
    const mediaCardSelector = '[data-testid="media-card"]';

    const mediaPageBefore = await context.newPage();
    await mediaPageBefore.goto("/o/testorg/media");
    await expect(
      mediaPageBefore.getByRole("heading", {
        name: "Media Library",
        exact: true,
      }),
    ).toBeVisible();
    // Both A and B uploaded the same file, so two cards
    await expect(
      mediaPageBefore
        .locator(mediaCardSelector)
        .filter({ hasText: "dummySlide.pdf" }),
    ).toHaveCount(2);
    // dummySlide2.pdf has not been uploaded yet
    await expect(mediaPageBefore.getByText("dummySlide2.pdf")).toHaveCount(0);
    await mediaPageBefore.close();

    // --- Replace import A with dummySlide2.pdf (3 pages) via Settings ---
    await page.getByRole("button", { name: "Settings" }).click();

    // Both imports show their original filename before replacing
    await expect(
      page.getByRole("heading", { level: 4, name: "dummySlide.pdf" }),
    ).toHaveCount(2);

    const firstReplaceButton = page
      .getByRole("button", { name: "Replace" })
      .first();
    const firstDeleteButton = page
      .getByRole("button", { name: "Delete" })
      .first();

    // First import in the list is A
    await firstReplaceButton.click();

    // Pick PDF in the replace modal and upload the new file
    await page.getByText("PDF", { exact: true }).click();
    await uppyUploadFile("./dummyFiles/dummySlide2.pdf");

    // --- While the replace is in progress ---

    const replacingIndicator = page.getByText("Replacing...", { exact: true });
    await expect(replacingIndicator).toBeVisible({ timeout: 15 * 1000 });

    // --- Wait for the replace to finish ---

    await expect(replacingIndicator).toBeHidden({ timeout: 60 * 1000 });

    // The new import's name now appears in the settings list
    await expect(
      page.getByRole("heading", { level: 4, name: "dummySlide2.pdf" }),
    ).toHaveCount(1);
    // Only one of the original "dummySlide.pdf" titles remains (the B import)
    await expect(
      page.getByRole("heading", { level: 4, name: "dummySlide.pdf" }),
    ).toHaveCount(1);

    // Buttons should be enabled again
    await expect(firstReplaceButton).toBeEnabled();
    await expect(firstDeleteButton).toBeEnabled();

    // After replace: A grows from 2 -> 3 slides, B is untouched, total = 5.
    // The order should be: A1', A2', A3', B1, B2.
    await expect
      .poll(async () => renderedSlides.count(), { timeout: 30 * 1000 })
      .toBe(5);

    // Close the Settings modal
    await page.getByRole("button", { name: "Close" }).first().click();

    // --- Verify the new order ---

    const newA1Src = await slideAt(0).getAttribute("src");
    const newA2Src = await slideAt(1).getAttribute("src");
    const newA3Src = await slideAt(2).getAttribute("src");
    const newB1Src = await slideAt(3).getAttribute("src");
    const newB2Src = await slideAt(4).getAttribute("src");

    // The first three slides come from the replacement PDF, so they must
    // differ from both the old A thumbnails and from B's thumbnails.
    expect(newA1Src).not.toBe(oldA1Src);
    expect(newA2Src).not.toBe(oldA2Src);
    expect(newA1Src).not.toBe(oldB1Src);
    expect(newA2Src).not.toBe(oldB2Src);
    expect(newA3Src).toBeTruthy();
    expect(newA3Src).not.toBe(oldA1Src);
    expect(newA3Src).not.toBe(oldA2Src);
    expect(newA3Src).not.toBe(oldB1Src);
    expect(newA3Src).not.toBe(oldB2Src);

    expect(new Set([newA1Src, newA2Src, newA3Src]).size).toBe(3);
    expect(newB1Src).toBe(oldB1Src);
    expect(newB2Src).toBe(oldB2Src);

    // --- Verify the replaced PDF media was deleted, and the new one was added ---
    const mediaPageAfter = await context.newPage();
    await mediaPageAfter.goto("/o/testorg/media");
    await expect(
      mediaPageAfter.getByRole("heading", {
        name: "Media Library",
        exact: true,
      }),
    ).toBeVisible();
    // A's original PDF was deleted; only B's "dummySlide.pdf" card remains
    await expect(
      mediaPageAfter
        .locator(mediaCardSelector)
        .filter({ hasText: "dummySlide.pdf" }),
    ).toHaveCount(1);
    // The replacement PDF is now in the library
    await expect(
      mediaPageAfter
        .locator(mediaCardSelector)
        .filter({ hasText: "dummySlide2.pdf" }),
    ).toHaveCount(1);
    await mediaPageAfter.close();
  });
});
