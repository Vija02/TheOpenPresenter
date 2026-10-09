import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import {
  type StubPlaylist,
  type StubVideo,
  stubYoutube,
} from "../../../../../helpers/youtubeStub";
import { MusicPlayerPlugin } from "../../../../../pages/MusicPlayerPlugin";
import type { ProjectPage } from "../../../../../pages/ProjectPage";

const first: StubVideo = {
  videoId: "aaaaaaaaaa1",
  title: "First Song",
  author: "Artist One",
  duration: 5,
};
const second: StubVideo = {
  videoId: "bbbbbbbbbb2",
  title: "Second Song",
  author: "Artist Two",
  duration: 120,
};
const third: StubVideo = {
  videoId: "cccccccccc3",
  title: "Third Song",
  author: "Artist Three",
  duration: 120,
};
const fourth: StubVideo = {
  videoId: "dddddddddd4",
  title: "Fourth Song",
  author: "Artist Four",
  duration: 10,
};

const autoplayOn = "Autoplay on: plays the next track when one finishes";

const worshipSet: StubPlaylist = {
  playlistId: "PLworshipset",
  title: "Sunday Set",
  videos: [first, second, third],
};

/** Music plays behind whatever is showing, so put something on screen */
const putSomethingOnScreen = async (
  page: Page,
  context: BrowserContext,
  projectPage: ProjectPage,
) => {
  await context.route("**://example.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "" }),
  );
  await projectPage.createPlugin("Embed");
  await page
    .getByPlaceholder("Paste a web address")
    .fill("https://example.com/page");
  await page.getByRole("button", { name: "Load" }).click();
  await page.getByRole("button", { name: "Go live" }).click();
};

test.describe.serial("Music Player Plugin: Playlist", () => {
  test.beforeEach(async ({ e2eCommand, context }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
    await stubYoutube(context, [first, second, third, fourth], [worshipSet]);
  });

  test("builds a playlist from a YouTube search", async ({
    page,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    await expect(page.getByText("No tracks yet.")).toBeVisible();

    await musicPlayerPlugin.submit("worship");
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText('Search YouTube for "worship"'),
    ).toBeVisible();

    // The search stays open so several tracks can be added in one go
    await dialog.getByRole("button", { name: /Second Song/ }).click();
    await dialog.getByRole("button", { name: /First Song/ }).click();
    await expect(
      dialog.getByRole("button", { name: /First Song/ }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Done (2 added)" }).click();
    await expect(dialog).toBeHidden();

    await expect(musicPlayerPlugin.tracks).toHaveCount(2);
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText("Second Song");
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText(
      "Artist Two • 02:00",
    );
    await expect(musicPlayerPlugin.tracks.nth(1)).toContainText("First Song");
  });

  test("adds a track from a pasted YouTube link", async ({
    page,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    await musicPlayerPlugin.submit(
      `https://www.youtube.com/watch?v=${third.videoId}`,
    );
    await expect(musicPlayerPlugin.track("Third Song")).toContainText(
      "Artist Three",
    );
    await expect(musicPlayerPlugin.input).toHaveValue("");

    await musicPlayerPlugin.submit("https://example.com/song.mp3");
    await expect(
      page.getByText("Only YouTube links are supported for now."),
    ).toBeVisible();
    await expect(musicPlayerPlugin.tracks).toHaveCount(1);
  });

  test("adds a whole YouTube playlist from a pasted link", async ({
    page,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    await musicPlayerPlugin.submit(
      `https://www.youtube.com/playlist?list=${worshipSet.playlistId}`,
    );
    await expect(
      page.getByText('Added 3 tracks from "Sunday Set".'),
    ).toBeVisible();
    await expect(musicPlayerPlugin.tracks).toHaveCount(3);
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText("First Song");
    await expect(musicPlayerPlugin.tracks.nth(2)).toContainText("Third Song");
    await expect(musicPlayerPlugin.input).toHaveValue("");

    await musicPlayerPlugin.submit(
      "https://www.youtube.com/playlist?list=PLprivate",
    );
    await expect(
      page.getByText("Couldn't load that playlist. It may be private."),
    ).toBeVisible();
    await expect(musicPlayerPlugin.tracks).toHaveCount(3);
  });

  test("asks about a video opened from a playlist", async ({
    page,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    const link = `https://www.youtube.com/watch?v=${second.videoId}&list=${worshipSet.playlistId}&index=2`;

    await musicPlayerPlugin.submit(link);
    await expect(
      page.getByText("This video is part of a playlist."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add this video" }).click();
    await expect(musicPlayerPlugin.tracks).toHaveCount(1);
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText("Second Song");
    await expect(
      page.getByText("This video is part of a playlist."),
    ).toBeHidden();

    await musicPlayerPlugin.submit(link);
    await page.getByRole("button", { name: "Add whole playlist" }).click();
    await expect(musicPlayerPlugin.tracks).toHaveCount(4);
  });

  test("adds music from the media library and plays it", async ({
    page,
    context,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    // Waits on the worker to process two uploads
    test.slow();
    await loginAndGoToProject();
    await putSomethingOnScreen(page, context, projectPage);
    await projectPage.createPlugin("Music Player");

    // Uploaded from the picker, so they're added before they've been processed
    for (const file of ["dummyAudio.mp3", "dummyAudio.mp3"]) {
      await musicPlayerPlugin.libraryButton.click();
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: "browse files" }).click(),
      ]);
      await fileChooser.setFiles(`./dummyFiles/${file}`);
      await expect(musicPlayerPlugin.libraryButton).toBeEnabled();
    }

    // Once processed, the file's own tags fill them in
    await expect(musicPlayerPlugin.tracks).toHaveCount(2);
    for (const i of [0, 1]) {
      await expect(musicPlayerPlugin.tracks.nth(i)).toContainText(
        "Dummy Artist • 00:04",
        { timeout: 60 * 1000 },
      );
    }

    const rendererPage = await projectPage.present();
    const requested = new Set<string>();
    rendererPage.on("request", (request) => {
      if (request.url().endsWith(".m4a")) requested.add(request.url());
    });
    await rendererPage.waitForLoadState("networkidle");

    // Ready before anyone presses play: the first is loaded into a player,
    // and the start of each is already fetched
    await expect(MusicPlayerPlugin.rendererAudio(rendererPage)).toHaveCount(1);
    await expect.poll(() => requested.size).toBe(2);

    await musicPlayerPlugin.tracks
      .nth(1)
      .getByRole("button", { name: /^Play / })
      .click();
    await expect(
      musicPlayerPlugin.nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();
    await expect(MusicPlayerPlugin.rendererAudio(rendererPage)).toHaveCount(1);
  });

  test("reorders and removes tracks", async ({
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    for (const video of [first, second, third]) {
      await musicPlayerPlugin.submit(
        `https://www.youtube.com/watch?v=${video.videoId}`,
      );
      await expect(musicPlayerPlugin.track(video.title)).toBeVisible();
    }

    await musicPlayerPlugin.dragTrack("First Song", "Second Song");
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText("Second Song");
    await expect(musicPlayerPlugin.tracks.nth(1)).toContainText("First Song");

    await musicPlayerPlugin.dragTrack("Third Song", "First Song");
    await expect(musicPlayerPlugin.tracks.nth(1)).toContainText("Third Song");

    await musicPlayerPlugin
      .track("Second Song")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(musicPlayerPlugin.tracks).toHaveCount(2);
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText("Third Song");
    await expect(musicPlayerPlugin.tracks.nth(1)).toContainText("First Song");
  });

  test("plays on the screen and moves to the next track by itself", async ({
    page,
    context,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await putSomethingOnScreen(page, context, projectPage);

    await projectPage.createPlugin("Music Player");
    for (const video of [first, second]) {
      await musicPlayerPlugin.submit(
        `https://www.youtube.com/watch?v=${video.videoId}`,
      );
      await expect(musicPlayerPlugin.track(video.title)).toBeVisible();
    }

    const rendererPage = await projectPage.present();
    await rendererPage.waitForLoadState("networkidle");

    await musicPlayerPlugin.playTrackButton("First Song").click();
    await expect(musicPlayerPlugin.nowPlaying).toContainText("First Song");
    await expect(
      MusicPlayerPlugin.rendererTrack(rendererPage, first.videoId),
    ).toHaveCount(1);
    // The next one loads ahead, ready to start on cue
    await expect(
      MusicPlayerPlugin.rendererTrack(rendererPage, second.videoId),
    ).toHaveCount(1);

    // First Song is 5s long, then the screen and remote follow on their own
    await expect(
      MusicPlayerPlugin.rendererTrack(rendererPage, first.videoId),
    ).toHaveCount(0, { timeout: 10 * 1000 });
    await expect(musicPlayerPlugin.nowPlaying).toContainText("Second Song");
    await expect(
      musicPlayerPlugin.nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();
  });

  test("crossfades into the next track", async ({
    page,
    context,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await putSomethingOnScreen(page, context, projectPage);

    await projectPage.createPlugin("Music Player");
    for (const video of [fourth, second]) {
      await musicPlayerPlugin.submit(
        `https://www.youtube.com/watch?v=${video.videoId}`,
      );
      await expect(musicPlayerPlugin.track(video.title)).toBeVisible();
    }

    const rendererPage = await projectPage.present();
    await rendererPage.waitForLoadState("networkidle");

    await musicPlayerPlugin.playTrackButton("Fourth Song").click();
    const nowPlaying = musicPlayerPlugin.nowPlaying;
    await nowPlaying.getByRole("button", { name: "Crossfade off" }).click();
    await page.getByRole("button", { name: "3 seconds" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Crossfade 3s" }),
    ).toBeVisible();

    // A reloaded player would start over, so it has to be this very one
    const fourthPlayer = MusicPlayerPlugin.rendererTrack(
      rendererPage,
      fourth.videoId,
    );
    await fourthPlayer.evaluate((iframe: HTMLIFrameElement) => {
      (window as any).__fourthPlayer = iframe.contentWindow;
    });

    // Fourth Song is 10s long, so Second Song takes over 3s before it ends
    await expect(nowPlaying).toContainText("Second Song", {
      timeout: 12 * 1000,
    });
    // ...while Fourth Song carries on underneath, fading out
    expect(
      await fourthPlayer.evaluate(
        (iframe: HTMLIFrameElement) =>
          iframe.contentWindow === (window as any).__fourthPlayer,
      ),
    ).toBe(true);
    await expect(
      MusicPlayerPlugin.rendererTrack(rendererPage, fourth.videoId),
    ).toHaveCount(0, { timeout: 5 * 1000 });
    await expect(
      MusicPlayerPlugin.rendererTrack(rendererPage, second.videoId),
    ).toHaveCount(1);
  });

  test("stops at the end of the playlist unless it repeats", async ({
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    await musicPlayerPlugin.submit(
      `https://www.youtube.com/watch?v=${first.videoId}`,
    );
    await musicPlayerPlugin.playTrackButton("First Song").click();

    const nowPlaying = musicPlayerPlugin.nowPlaying;
    await nowPlaying.getByRole("button", { name: "Repeat off" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Repeat playlist" }),
    ).toBeVisible();

    // Well past the end of the track, it's still going
    await musicPlayerPlugin.page.waitForTimeout(7 * 1000);
    await expect(
      nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();

    await nowPlaying.getByRole("button", { name: "Repeat playlist" }).click();
    await nowPlaying.getByRole("button", { name: "Repeat track" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Repeat off" }),
    ).toBeVisible();

    await expect(nowPlaying.getByRole("button", { name: "Play" })).toBeVisible({
      timeout: 10 * 1000,
    });

    // Playing a finished playlist starts it again
    await nowPlaying.getByRole("button", { name: "Play" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();
  });

  test("stops after the current track with autoplay off", async ({
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");
    for (const video of [first, second]) {
      await musicPlayerPlugin.submit(
        `https://www.youtube.com/watch?v=${video.videoId}`,
      );
      await expect(musicPlayerPlugin.track(video.title)).toBeVisible();
    }

    await musicPlayerPlugin.playTrackButton("First Song").click();
    const nowPlaying = musicPlayerPlugin.nowPlaying;
    // On unless someone turns it off
    await nowPlaying.getByRole("button", { name: autoplayOn }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Autoplay off" }),
    ).toBeVisible();

    // First Song is 5s long, and it stays on it once it's done
    await expect(nowPlaying.getByRole("button", { name: "Play" })).toBeVisible({
      timeout: 10 * 1000,
    });
    await expect(nowPlaying).toContainText("First Song");

    // Playing a finished track starts it again, not the playlist
    await nowPlaying.getByRole("button", { name: "Play" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();
    await expect(nowPlaying).toContainText("First Song");
  });

  test("autoplay goes with repeating the playlist and crossfading", async ({
    page,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");
    await musicPlayerPlugin.submit(
      `https://www.youtube.com/watch?v=${second.videoId}`,
    );
    await musicPlayerPlugin.playTrackButton("Second Song").click();

    const nowPlaying = musicPlayerPlugin.nowPlaying;
    await nowPlaying.getByRole("button", { name: "Repeat off" }).click();
    await nowPlaying.getByRole("button", { name: "Crossfade off" }).click();
    await page.getByRole("button", { name: "3 seconds" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Repeat playlist" }),
    ).toBeVisible();
    await expect(
      nowPlaying.getByRole("button", { name: "Crossfade 3s" }),
    ).toBeVisible();

    // Both only apply while moving between tracks, so they go off with it
    await nowPlaying.getByRole("button", { name: autoplayOn }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Repeat off" }),
    ).toBeVisible();
    await expect(
      nowPlaying.getByRole("button", { name: "Crossfade off" }),
    ).toBeVisible();

    // ...and either one brings it back
    await nowPlaying.getByRole("button", { name: "Crossfade off" }).click();
    await page.getByRole("button", { name: "3 seconds" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: autoplayOn }),
    ).toBeVisible();

    await nowPlaying.getByRole("button", { name: autoplayOn }).click();
    await nowPlaying.getByRole("button", { name: "Repeat off" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: autoplayOn }),
    ).toBeVisible();
  });
});

// A public-link viewer (the logged-out demo lands on one) has no session. They
// can still search YouTube and add tracks by link.
test.describe("Music Player Plugin: public access", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);

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
              scenes: [
                {
                  pluginName: "radio",
                  name: "Music Player",
                  activate: true,
                  pluginData: { url: "", tracks: [] },
                  rendererPluginData: {
                    url: null,
                    isPlaying: false,
                    volume: 1,
                    activeTrackId: null,
                    trackState: {
                      uid: "initial",
                      isPlaying: false,
                      volume: 1,
                      muted: false,
                      seek: 0,
                      startedAt: 0,
                      onFinishBehaviour: "pause",
                    },
                    repeatMode: "off",
                    crossfadeSeconds: 0,
                    fadingOutTrack: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("a logged-out viewer can search YouTube and add a track", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const musicPlayerPlugin = new MusicPlayerPlugin(page);
    try {
      await stubYoutube(context, [first, second]);
      await page.goto("/app/testorg/testproject");
      await expect(page.getByText("No tracks yet.")).toBeVisible();

      await musicPlayerPlugin.submit("worship");
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: /Second Song/ }).click();
      await dialog.getByRole("button", { name: "Done (1 added)" }).click();

      await expect(musicPlayerPlugin.tracks).toHaveCount(1);
      await expect(musicPlayerPlugin.tracks.nth(0)).toContainText(
        "Second Song",
      );
    } finally {
      await context.close();
    }
  });

  // The UI test stubs YouTube in the browser, so this checks the server
  // itself lets a logged-out call through. A bad link fails before YouTube is
  // ever contacted, so the spec doesn't depend on it.
  test("the YouTube lookups don't require a login", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const res = await context.request.post(
        "/trpc/musicPlayer.youtubeMetadata",
        {
          headers: { "x-top-csrf-protection": "1" },
          data: { url: "not a youtube link" },
        },
      );
      const body = await res.json();
      expect(body.error.data.code).not.toBe("UNAUTHORIZED");
      expect(body.error.message).toBe("Invalid YouTube URL");
    } finally {
      await context.close();
    }
  });
});
