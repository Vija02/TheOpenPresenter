import { type Browser } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import { LyricsPlugin } from "../../../../../pages/LyricsPlugin";

// A public-link viewer (the marketing demo QR lands on one) has no session, so
// anything org-scoped has to be hidden. Importing from MyWorshipList, however,
// only proxies a third-party public API — those procedures are registered with
// `publicProcedure` and must keep working here.
//
// The project is seeded directly (public, with an empty lyrics scene) rather
// than driving login → create plugin → "Make project public", so each test is
// one cheap POST plus a single page load.
//
// NOTE: the import tests hit the live MyWorshipList API, matching the existing
// lyrics-presenter-songbook.spec.ts.
const MWL_SONG = "Shout to the Lord";

const SONG_CONTENT = `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me`;

/** An empty lyrics-presenter scene, matching the plugin's own initial data. */
const LYRICS_SCENE = {
  pluginName: "lyrics-presenter",
  name: "Lyrics",
  activate: true,
  pluginData: { songs: [], videoBackgrounds: [] },
  rendererPluginData: { songId: null, currentIndex: null },
};

const PUBLIC_PROJECT_URL = "/app/testorg/testproject";

test.describe("Lyrics Presenter - public access", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);

    // POSTs the seed; unlike `login()` this doesn't navigate, so we never pay
    // for an authenticated app load we don't assert on.
    await e2eCommand.loginWithScenes({
      orgs: [
        {
          name: "TestOrg",
          slug: "testorg",
          projects: [
            {
              name: "TestProject",
              slug: "testproject",
              isPublic: true,
              scenes: [LYRICS_SCENE],
            },
          ],
        },
      ],
    });
  });

  /** Open the seeded public project in a fresh, sessionless context. */
  const openPublicly = async (browser: Browser) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(PUBLIC_PROJECT_URL);
    return { context, page, lyrics: new LyricsPlugin(page) };
  };

  test("hides songbook affordances but keeps MyWorshipList import available", async ({
    browser,
  }) => {
    const { context, page, lyrics } = await openPublicly(browser);
    try {
      await expect(page.getByTestId("ly-landing")).toBeVisible();

      // Org-scoped: gone.
      await expect(lyrics.songbookButton).toHaveCount(0);
      await expect(page.getByText("Recently used songs")).toHaveCount(0);

      // Third-party import: still there.
      await expect(lyrics.searchSongTitleInput).toBeVisible();
      await expect(page.getByText("Import a setlist")).toBeVisible();

      // Searching returns MyWorshipList results, with no Songbook section.
      await lyrics.searchSongTitleInput.fill(MWL_SONG);
      await expect(page.getByTestId("ly-import-result").first()).toBeVisible();
      await expect(page.getByTestId("ly-songbook-result")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("a public viewer can import a song from MyWorshipList", async ({
    browser,
  }) => {
    const { context, page, lyrics } = await openPublicly(browser);
    try {
      await expect(lyrics.searchSongTitleInput).toBeVisible();

      await lyrics.addSong(MWL_SONG);

      // The song imported and renders slides — the demo's core flow.
      await expect(page.getByTestId("ly-edit-song")).toHaveCount(1);
      await expect(page.getByTestId("slide-container").first()).toBeVisible();

      // It must not be linked to a songbook it cannot reach, and must not
      // offer to save.
      await expect(page.getByTestId("ly-save-song")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("the import view offers no 'Save to songbook' option publicly", async ({
    browser,
  }) => {
    const { context, page, lyrics } = await openPublicly(browser);
    try {
      await expect(lyrics.searchSongTitleInput).toBeVisible();
      await lyrics.openImportSong(MWL_SONG);

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByPlaceholder("Song name").first()).toBeVisible();
      await expect(
        dialog.locator("label").filter({ hasText: "Save to songbook" }),
      ).toHaveCount(0);
      await expect(dialog.getByText("Import settings")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("a public viewer can still create a song by hand", async ({
    browser,
  }) => {
    const { context, page, lyrics } = await openPublicly(browser);
    try {
      await expect(lyrics.searchSongTitleInput).toBeVisible();

      // The create flow is entirely offline — no songbook, no import.
      await lyrics.addCustomSong("Amazing Grace", SONG_CONTENT);

      await expect(page.getByTestId("ly-edit-song")).toHaveCount(1);
      await expect(page.getByTestId("ly-save-song")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
