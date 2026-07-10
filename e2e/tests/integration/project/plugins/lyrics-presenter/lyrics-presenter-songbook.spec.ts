import { expect, test } from "../../../../../fixtures/projectFixture";

// NOTE: The import / setlist tests hit the live MyWorshipList API (the
// search/getSong/playlist tRPC procedures call it server-side, so it can't be
// mocked from the browser). This mirrors the existing keyPress.spec.ts, which
// also relies on live MyWorshipList results.
const MWL_SONG = "Shout to the Lord";

const CUSTOM_SONG_CONTENT = `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me`;

test.describe("Lyrics Presenter - Songbook & Import", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  // ---------------------------------------------------------------------------
  // Importing a single song
  // ---------------------------------------------------------------------------

  test("imports a single song from MyWorshipList", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    await lyricsPlugin.addSong(MWL_SONG);

    // The imported song renders its slides in the list.
    await expect(page.getByTestId("slide-container").first()).toBeVisible();
    // Imported-with-save (default) → linked → no "Unsaved" affordance.
    await expect(page.getByTestId("ly-save-song")).toHaveCount(0);
  });

  test("import without 'Save to songbook' leaves the song unsaved, then Save links it", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    await lyricsPlugin.openImportSong(MWL_SONG);

    // Uncheck "Save to songbook", then import.
    await page
      .locator("label")
      .filter({ hasText: "Save to songbook" })
      .getByRole("checkbox")
      .uncheck();
    await lyricsPlugin.importFormButton.click();

    // Unlinked song shows the Unsaved/Save badge.
    const saveBadge = lyricsPlugin.savedBadge();
    await expect(saveBadge).toBeVisible();

    // Saving links it — the badge disappears.
    await saveBadge.click();
    await expect(page.getByTestId("ly-save-song")).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // Songbook: browse modal (add to list + delete). Local DB, no network.
  // ---------------------------------------------------------------------------

  test("saved song appears in the songbook and can be added to the list", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    // Create a song (saved to the songbook by default).
    await lyricsPlugin.addCustomSong("Amazing Grace", CUSTOM_SONG_CONTENT);
    await expect(page.getByText("Amazing Grace").first()).toBeVisible();

    await lyricsPlugin.openSongbookModal();
    await expect(lyricsPlugin.songbookRow("Amazing Grace")).toBeVisible();

    // Add it to the current list (a second copy) and close the modal.
    await lyricsPlugin.songbookAddToList("Amazing Grace");
    await lyricsPlugin.closeDialog();

    await expect(page.getByText("Amazing Grace", { exact: true })).toHaveCount(
      2,
    );
  });

  test("songbook entries can be deleted", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    await lyricsPlugin.addCustomSong("To Delete", CUSTOM_SONG_CONTENT);

    await lyricsPlugin.openSongbookModal();
    await expect(lyricsPlugin.songbookRow("To Delete")).toBeVisible();

    await lyricsPlugin.songbookDelete("To Delete");

    // Gone from the songbook.
    await expect(lyricsPlugin.songbookRow("To Delete")).toHaveCount(0);
  });

  test("previews a saved song inline, collapses it, then adds it to the list", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    // Create + save a song so it appears in the recent/songbook list.
    await lyricsPlugin.addCustomSong("Great Is Thy", CUSTOM_SONG_CONTENT);
    await expect(page.getByText("Great Is Thy").first()).toBeVisible();

    // Re-open the add modal and select the saved song → inline preview appears.
    const scope = await lyricsPlugin.openAddSurface();
    const row = scope
      .getByTestId("ly-recent-song")
      .filter({ hasText: "Great Is Thy" });
    await row.click();

    const preview = scope.getByTestId("ly-song-preview");
    await expect(preview).toBeVisible();
    // Lyrics are shown (chords/headings stripped).
    await expect(preview).toContainText("Amazing grace how sweet the sound");

    // The close control collapses the preview.
    await scope.getByTestId("ly-song-preview-close").click();
    await expect(preview).toHaveCount(0);

    // Re-select and add it — a second copy lands in the list.
    await row.click();
    await preview.getByRole("button", { name: "Add to list" }).click();
    await expect(page.getByText("Great Is Thy")).toHaveCount(2);
  });

  test("a recently used song can be re-added from the 'Recently used' list", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    // Importing a song saves it and records it as recently used.
    await lyricsPlugin.addSong(MWL_SONG);
    await expect(page.getByTestId("ly-edit-song")).toHaveCount(1);

    // Re-open the add modal; the song is listed under "Recently used".
    const scope = await lyricsPlugin.openAddSurface();
    await expect(scope.getByText("Recently used songs")).toBeVisible();
    const row = scope
      .getByTestId("ly-recent-song")
      .filter({ hasText: MWL_SONG });
    await expect(row).toBeVisible();

    // Add it from the recent list via its inline preview.
    await row.click();
    await scope
      .getByTestId("ly-song-preview")
      .getByRole("button", { name: "Add to list" })
      .click();

    await expect(page.getByTestId("ly-edit-song")).toHaveCount(2);
  });

  // ---------------------------------------------------------------------------
  // Songbook sync: linked scene songs stay in step with the songbook entry.
  // ---------------------------------------------------------------------------

  test("editing a linked song syncs the change to its songbook siblings", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    // Create a saved song (linked to the songbook by default).
    await lyricsPlugin.addCustomSong("Sync Song", CUSTOM_SONG_CONTENT);
    await expect(page.getByText("Sync Song")).toHaveCount(1);

    // Add a second copy linked to the same songbook entry (from the recent list).
    const scope = await lyricsPlugin.openAddSurface();
    await scope
      .getByTestId("ly-recent-song")
      .filter({ hasText: "Sync Song" })
      .click();
    await scope
      .getByTestId("ly-song-preview")
      .getByRole("button", { name: "Add to list" })
      .click();
    await expect(page.getByText("Sync Song")).toHaveCount(2);

    // Edit the first copy's title and save — this writes back to the songbook.
    await page.getByTestId("ly-edit-song").first().click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("Title").fill("Synced Title");
    await editDialog.getByRole("button", { name: "Save" }).click();

    // The songbook round-trip reconciles every linked scene song, so both
    // copies now show the new title.
    await expect(page.getByText("Synced Title")).toHaveCount(2);
  });

  // ---------------------------------------------------------------------------
  // Importing a setlist
  // ---------------------------------------------------------------------------

  test("imports a setlist from MyWorshipList", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    await lyricsPlugin.importFirstSetlist();

    // At least one song from the setlist was added and rendered.
    await expect(page.getByTestId("slide-container").first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Permutation: re-importing the same song creates a fresh (non-deduped) copy.
  // ---------------------------------------------------------------------------

  test("re-importing the same song adds another copy (no dedup)", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    await lyricsPlugin.addSong(MWL_SONG);
    await lyricsPlugin.addSong(MWL_SONG);

    await expect(page.getByTestId("slide-container").first()).toBeVisible();
    // Two separate scene songs were added.
    await expect(page.getByTestId("ly-edit-song")).toHaveCount(2);
  });

  // ---------------------------------------------------------------------------
  // Landing (empty state) + sub-route modal wiring. The cancel/back tests open
  // the import sub-route, which hits the live MyWorshipList API.
  // ---------------------------------------------------------------------------

  test("empty plugin shows the inline landing add-song UI (no modal)", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    // The add UI is rendered inline — not behind a modal.
    await expect(page.getByTestId("ly-landing")).toBeVisible();
    await expect(lyricsPlugin.searchSongTitleInput).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("cancelling a landing sub-route returns to the landing without adding", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    // Open a sub-route from the landing (the import view), then cancel it.
    await lyricsPlugin.openImportSong(MWL_SONG);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Back on the landing, nothing added.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("ly-landing")).toBeVisible();
    await expect(page.getByTestId("ly-edit-song")).toHaveCount(0);
  });

  test("the back button on a landing sub-route returns to the landing", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    await lyricsPlugin.openImportSong(MWL_SONG);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Back" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("ly-landing")).toBeVisible();
  });
});
