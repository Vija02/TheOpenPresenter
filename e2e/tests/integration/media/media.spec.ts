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

  test("can upload audio and play the processed copy", async ({
    page,
    mediaPage,
    loginDefault,
    uppyUploadFile,
  }) => {
    await loginDefault("/o/testorg/media");

    await mediaPage.uploadButton.click();
    await uppyUploadFile("./dummyFiles/dummyAudio.mp3");
    await expect(mediaPage.uppyDashboard).toBeHidden({ timeout: 30000 });

    const mediaCard = mediaPage.getMediaCardByName("dummyAudio.mp3");
    await expect(mediaCard).toBeVisible({ timeout: 10000 });

    const processingOverlay = mediaCard.locator(
      ".ui--media-preview-processing-overlay",
    );
    await expect(processingOverlay).toBeVisible();
    await expect(processingOverlay).toBeHidden({ timeout: 60000 });

    // The cover art embedded in the mp3
    await expect(mediaCard.locator("img")).toHaveAttribute(
      "src",
      /\/media\/data\/media_\w+\.jpg$/,
    );

    await mediaCard.getByTitle("Play audio").click();
    const audio = mediaCard.locator("audio");
    await expect(audio).toHaveAttribute(
      "src",
      /\/media\/data\/media_\w+\.m4a$/,
    );

    const response = await page.request.get((await audio.getAttribute("src"))!);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeGreaterThan(1000);
  });

  test("processes audio that has no metadata", async ({
    page,
    mediaPage,
    loginDefault,
    e2eCommand,
  }) => {
    await loginDefault("/o/testorg/media");
    await e2eCommand.seedAudioMediaWithoutMetadata({
      orgSlug: "testorg",
      audioPath: "./dummyFiles/dummyAudio.mp3",
    });
    await page.reload();

    const mediaCard = mediaPage.getMediaCardByName("dummyAudio.mp3");
    const processingOverlay = mediaCard.locator(
      ".ui--media-preview-processing-overlay",
    );
    await expect(processingOverlay).toBeVisible({ timeout: 10000 });

    await e2eCommand.serverCommand("queueMissingAudioTranscodes");
    await expect(processingOverlay).toBeHidden({ timeout: 60000 });

    // Old audio keeps its levels, so the mp3 plays as it is
    await mediaCard.getByTitle("Play audio").click();
    await expect(mediaCard.locator("audio")).toHaveAttribute(
      "src",
      /\/media\/data\/media_\w+\.mp3$/,
    );
  });
});
