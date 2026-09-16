import { expect, test } from "../../../../../fixtures/projectFixture";

/**
 * Chords in the song editor: showing and hiding them, the chord toolbar, and
 * transposing.
 *
 * Serial, like the other plugin specs: they all log in as the same `testorg`,
 * and the beforeEach sweep would pull that org out from under a sibling test
 * running at the same time.
 */

const PLAIN_SONG = `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me`;

const CHORDED_SONG = `[Verse 1]
[G]Amazing grace how [C]sweet the sound
That [D]saved a wretch like [G]me`;

/** An intro with no lyric under it, written the OpenSong way. */
const OPENSONG_SONG = `[Intro]
.| G /// | Em / C / |
[Verse 1]
[G]Amazing grace how [C]sweet the sound`;

test.describe.serial("Lyrics Presenter - Chords", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("hides chords by default and shows them on demand", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", CHORDED_SONG);

    await lyricsPlugin.openEditSong();

    // Chords start hidden: the lyrics are there, the chords are not.
    await expect(lyricsPlugin.songEditor).toContainText("Amazing grace how");
    await expect(lyricsPlugin.songEditor).not.toContainText("[G]");
    await expect(lyricsPlugin.chordToolbar).toBeHidden();

    await lyricsPlugin.showChords();

    await expect(lyricsPlugin.songEditor).toContainText("[G]Amazing grace");
    await expect(lyricsPlugin.chordToolbar).toBeVisible();

    await lyricsPlugin.hideChords();

    await expect(lyricsPlugin.songEditor).not.toContainText("[G]");
    await expect(lyricsPlugin.chordToolbar).toBeHidden();
  });

  test("offers no chord controls for a song without chords", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", PLAIN_SONG);

    await lyricsPlugin.openEditSong();

    await expect(lyricsPlugin.songEditor).toContainText("Amazing grace how");
    await expect(lyricsPlugin.toggleChordsButton).toBeHidden();
    await expect(lyricsPlugin.chordToolbar).toBeHidden();
  });

  test("shows chords automatically when one is typed", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", PLAIN_SONG);

    await lyricsPlugin.openEditSong();
    await expect(lyricsPlugin.toggleChordsButton).toBeHidden();

    // Typing a chord while they are hidden would otherwise make it vanish.
    await lyricsPlugin.typeAtStartOfLine("Amazing grace", "[G]");

    await expect(lyricsPlugin.chordToolbar).toBeVisible();
    await expect(
      lyricsPlugin.toggleChordsButton.filter({ hasText: "Hide chords" }),
    ).toBeVisible();
    await expect(lyricsPlugin.songEditor).toContainText("[G]Amazing grace");
  });

  test("transposes the song and moves its key with it", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", CHORDED_SONG);

    await lyricsPlugin.openEditSong();
    await lyricsPlugin.showChords();

    // No key was given, so it is guessed from the first chord.
    await expect(lyricsPlugin.transposeKey).toHaveText("G");

    await lyricsPlugin.transposeUp();

    await expect(lyricsPlugin.transposeKey).toHaveText("Ab");
    await expect(lyricsPlugin.songEditor).toContainText("[Ab]Amazing grace");
    await expect(lyricsPlugin.songEditor).toContainText("[Db]sweet");

    await lyricsPlugin.transposeDown();

    await expect(lyricsPlugin.transposeKey).toHaveText("G");
    await expect(lyricsPlugin.songEditor).toContainText("[G]Amazing grace");
  });

  test("removes every chord but keeps the lyrics", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", CHORDED_SONG);

    await lyricsPlugin.openEditSong();
    await lyricsPlugin.showChords();
    await lyricsPlugin.removeAllChords();

    await expect(lyricsPlugin.songEditor).toContainText(
      "Amazing grace how sweet the sound",
    );
    await expect(lyricsPlugin.songEditor).not.toContainText("[G]");

    // With the chords gone, so are the controls for them.
    await expect(lyricsPlugin.chordToolbar).toBeHidden();
    await expect(lyricsPlugin.toggleChordsButton).toBeHidden();

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByTestId("slide-container").first()).toContainText(
      "Amazing grace how sweet the sound",
    );
  });

  test("keeps an OpenSong chord line hidden with the rest", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", OPENSONG_SONG);

    await lyricsPlugin.openEditSong();

    // A bar-line intro has no lyric to inline into, so it stays a chord line
    // and counts as a chord for showing and hiding.
    await expect(lyricsPlugin.toggleChordsButton).toBeVisible();
    await expect(lyricsPlugin.songEditor).not.toContainText("/// |");

    await lyricsPlugin.showChords();

    await expect(lyricsPlugin.songEditor).toContainText("| G /// | Em / C / |");

    // Its chords are transposed along with the inline ones.
    await lyricsPlugin.transposeUp();

    await expect(lyricsPlugin.songEditor).toContainText(
      "| Ab /// | Fm / Db / |",
    );
  });

  test("saves the chords that were edited while hidden", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", CHORDED_SONG);

    await lyricsPlugin.openEditSong();

    // Edit a lyric with the chords hidden, then save.
    await lyricsPlugin.appendToEditor(" today");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByTestId("slide-container").first()).toContainText(
      "That saved a wretch like me today",
    );

    // The chords were kept even though they were never on screen.
    await lyricsPlugin.openEditSong();
    await lyricsPlugin.showChords();

    await expect(lyricsPlugin.songEditor).toContainText("[G]Amazing grace");
    await expect(lyricsPlugin.songEditor).toContainText("like [G]me today");
  });

  test("explains the format in a help drawer", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", CHORDED_SONG);

    await lyricsPlugin.openEditSong();
    await page.getByTestId("ly-format-help").click();

    const panel = page.getByTestId("ly-format-help-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Formatting songs");
    await expect(panel).toContainText("[G]Amazing [C]grace how [D]sweet");
  });

  test("keeps the chords lined up when a line is added with chords hidden", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", CHORDED_SONG);

    await lyricsPlugin.openEditSong();

    // Enter at the end of the heading, with the chords hidden. This used to
    // shift every line onto its neighbour's chords and strand a stray one on
    // the new blank line.
    await lyricsPlugin.pressAtEndOfLine("[Verse 1]", "Enter");

    await lyricsPlugin.showChords();

    await expect(lyricsPlugin.songEditor).toContainText(
      "[G]Amazing grace how [C]sweet the sound",
    );
    await expect(lyricsPlugin.songEditor).toContainText(
      "That [D]saved a wretch like [G]me",
    );
  });

  test("keeps both halves' chords when a line is split with chords hidden", async ({
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");
    await lyricsPlugin.addCustomSong("Amazing Grace", CHORDED_SONG);

    await lyricsPlugin.openEditSong();

    // Enter mid-line, with the chords hidden. The second half used to come back
    // with no chords at all.
    await lyricsPlugin.pressBeforeWord(
      "Amazing grace how sweet",
      "how",
      "Enter",
    );

    await lyricsPlugin.showChords();

    await expect(lyricsPlugin.songEditor).toContainText("[G]Amazing grace");
    await expect(lyricsPlugin.songEditor).toContainText("how [C]sweet");
  });
});
