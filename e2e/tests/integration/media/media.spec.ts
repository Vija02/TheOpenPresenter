import { expect, test } from "../../../fixtures/mediaFixture";

test.describe("Media Page", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can upload a video and see it process to completion", async ({
    page,
    mediaPage,
    loginDefault,
    uppyUploadFile,
  }) => {
    await loginDefault("/o/testorg/media");

    await expect(
      page.getByRole("heading", { name: "Media Library", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Welcome to your Media Library!"),
    ).toBeVisible();

    // Click upload button to open modal
    await mediaPage.uploadButton.click();

    await uppyUploadFile("./dummyFiles/dummyVideo.mp4");

    // Wait for upload to complete and modal to close
    await expect(mediaPage.uppyDashboard).toBeHidden({ timeout: 30000 });

    // Verify the media card appears
    const mediaCard = mediaPage.getMediaCardByName("dummyVideo.mp4");
    await expect(mediaCard).toBeVisible({ timeout: 10000 });

    // Verify processing status is shown (could be "Queued" or "Processing X%")
    const processingOverlay = mediaCard.locator(
      ".ui--media-preview-processing-overlay",
    );
    await expect(processingOverlay).toBeVisible();

    // Wait for processing to complete - the overlay should disappear
    await expect(processingOverlay).toBeHidden({ timeout: 60000 });
  });
});
