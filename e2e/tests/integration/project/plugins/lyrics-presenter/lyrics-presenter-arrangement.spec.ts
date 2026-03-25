import { expect, test } from "../../../../../fixtures/projectFixture";

const TEST_SONG_CONTENT = `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me

[Verse 2]
Twas grace that taught my heart to fear
And grace my fears relieved

[Chorus]
My chains are gone I've been set free
My God my Savior has ransomed me`;

test.describe("Lyrics Presenter Plugin - Arrangement Feature", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can arrange sections and verify changes are saved", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", TEST_SONG_CONTENT);

    // Wait for song to be added
    await expect(
      page.getByText("Amazing grace how sweet the").first(),
    ).toBeVisible();

    // Click the edit button to open the edit modal
    await page.getByTestId("ly-edit-song").click();

    // Switch to the Arrange tab
    await page.getByRole("tab", { name: "Arrange" }).click();

    // Verify initial arrangement shows all sections in order
    const dropzone = page.getByTestId("ly-arrangement-dropzone");
    await expect(dropzone).toBeVisible();

    const items = dropzone.getByTestId("ly-arrangement-item");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("Verse 1");
    await expect(items.nth(1)).toContainText("Verse 2");
    await expect(items.nth(2)).toContainText("Chorus");

    // --- Test adding sections by clicking ---
    await page.getByTestId("ly-available-section-Chorus").click();
    await expect(items).toHaveCount(4);
    await expect(items.nth(3)).toContainText("Chorus");

    // --- Test removing sections ---
    // Remove the last Chorus we just added
    await items.nth(3).getByTestId("ly-arrangement-item-remove").click();
    await expect(items).toHaveCount(3);

    // Remove Verse 2
    await items.nth(1).getByTestId("ly-arrangement-item-remove").click();
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Verse 1");
    await expect(items.nth(1)).toContainText("Chorus");

    // --- Test reset to default ---
    const resetButton = page.getByRole("button", { name: "Reset to Default" });
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("Verse 1");
    await expect(items.nth(1)).toContainText("Verse 2");
    await expect(items.nth(2)).toContainText("Chorus");
    await expect(resetButton).not.toBeVisible();

    // --- Test rearranging and saving ---
    // Remove all items
    await items.nth(0).getByTestId("ly-arrangement-item-remove").click();
    await items.nth(0).getByTestId("ly-arrangement-item-remove").click();
    await items.nth(0).getByTestId("ly-arrangement-item-remove").click();

    // Add in new order: Chorus, Verse 1, Verse 2
    await page.getByTestId("ly-available-section-Chorus").click();
    await page.getByTestId("ly-available-section-Verse 1").click();
    await page.getByTestId("ly-available-section-Verse 2").click();

    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("Chorus");
    await expect(items.nth(1)).toContainText("Verse 1");
    await expect(items.nth(2)).toContainText("Verse 2");

    // Save the changes
    await page.getByRole("button", { name: "Save" }).click();

    // Verify modal is closed
    await expect(
      page.getByRole("heading", { name: 'Edit song "Amazing Grace"' }),
    ).not.toBeVisible();

    // Verify slides now show in the new order
    const slides = page.getByTestId("slide-container");
    await expect(slides).toHaveCount(3);
    await expect(slides.nth(0)).toContainText("My chains are gone");
    await expect(slides.nth(1)).toContainText("Amazing grace");
    await expect(slides.nth(2)).toContainText("Twas grace");
  });
});
