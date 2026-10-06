import { expect, test } from "../../../../../fixtures/projectFixture";
import {
  type StubVideo,
  stubYoutube,
} from "../../../../../helpers/youtubeStub";
import { MusicPlayerPlugin } from "../../../../../pages/MusicPlayerPlugin";

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

test.describe.serial("Music Player Plugin: Playlist", () => {
  test.beforeEach(async ({ e2eCommand, context }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
    await stubYoutube(context, [first, second, third, fourth]);
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

    // Music plays behind whatever is showing, so put something on screen
    await context.route("**://example.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
    );
    await projectPage.createPlugin("Embed");
    await page
      .getByPlaceholder("Paste a web address")
      .fill("https://example.com/page");
    await page.getByRole("button", { name: "Load" }).click();
    await page.getByRole("button", { name: "Go live" }).click();

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

    await context.route("**://example.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
    );
    await projectPage.createPlugin("Embed");
    await page
      .getByPlaceholder("Paste a web address")
      .fill("https://example.com/page");
    await page.getByRole("button", { name: "Load" }).click();
    await page.getByRole("button", { name: "Go live" }).click();

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
});
