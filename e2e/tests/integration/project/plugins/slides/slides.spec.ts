import { expect, test } from "../../../../../fixtures/projectFixture";

test.describe("Slides Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can upload pdf and it is shown", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Slides");

    await expect(page.getByRole("heading")).toContainText(
      "Welcome to Slides Presenter",
    );
    await expect(page.getByText("Google Slides")).toBeVisible();
    await expect(page.getByText("PDF")).toBeVisible();
    await expect(page.getByText("Powerpoint")).toBeVisible();

    await page.locator("div").filter({ hasText: /^PDF$/ }).click();

    // Upload the file
    await uppyUploadFile("./dummyFiles/dummySlide.pdf");

    // Wait for image to be uploaded
    await expect(
      page.getByTestId("slide-container").nth(1).getByRole("img"),
    ).toBeInViewport({ timeout: 20 * 1000 });

    // Present it & open
    await page.getByTestId("slide-container").nth(1).click();
    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");

    // Match screenshot
    await expect(presentedPage).toHaveScreenshot();
  });

  test("can upload pptx and it is shown", async ({
    page,
    projectPage,
    loginAndGoToProject,
    uppyUploadFile,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Slides");

    await expect(page.getByRole("heading")).toContainText(
      "Welcome to Slides Presenter",
    );
    await expect(page.getByText("Google Slides")).toBeVisible();
    await expect(page.getByText("PDF")).toBeVisible();
    await expect(page.getByText("Powerpoint")).toBeVisible();

    await page
      .locator("div")
      .filter({ hasText: /^Powerpoint$/ })
      .click();

    // Upload the file
    await uppyUploadFile("./dummyFiles/dummySlide.pptx");

    // Wait for image to be uploaded
    await expect(
      page.getByTestId("slide-container").nth(1).getByRole("img"),
    ).toBeInViewport({ timeout: 20 * 1000 });

    // Present it & open
    await page.getByTestId("slide-container").nth(1).click();
    const presentedPage = await projectPage.present();
    await presentedPage.waitForLoadState("networkidle");

    // Match screenshot
    await expect(presentedPage).toHaveScreenshot();
  });
});
