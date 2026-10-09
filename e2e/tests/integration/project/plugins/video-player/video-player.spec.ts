import { expect, test } from "../../../../../fixtures/projectFixture";
import {
  type StubVideo,
  stubVideoPlayerYoutube,
} from "../../../../../helpers/youtubeStub";
import { VideoPlayerPlugin } from "../../../../../pages/VideoPlayerPlugin";

const first: StubVideo = {
  videoId: "aaaaaaaaaa1",
  title: "First Video",
  author: "Channel One",
  duration: 5,
};
const second: StubVideo = {
  videoId: "bbbbbbbbbb2",
  title: "Second Video",
  author: "Channel Two",
  duration: 120,
};
const third: StubVideo = {
  videoId: "cccccccccc3",
  title: "Third Video",
  author: "Channel Three",
  duration: 5,
};
const long: StubVideo = {
  videoId: "dddddddddd4",
  title: "Long Video",
  author: "Channel Four",
  duration: 20,
};

const autoplayOn = "Autoplay on: plays the next video when one finishes";

test.describe("Video Player Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can search for a youtube video", async ({
    page,
    projectPage,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();

    await projectPage.createPlugin("Video Player");

    // Verify the video player plugin is loaded
    await expect(videoPlayerPlugin.searchInput).toBeVisible();

    // Enter a search query
    await videoPlayerPlugin.searchInput.fill("test video");
    await page.getByRole("button", { name: "Go" }).click();

    // Verify the YouTube search modal opens
    await expect(page.getByText("Youtube Search")).toBeVisible();

    // Wait for search results to load (skeleton should disappear and results should appear)
    await expect(page.locator(".grid img").first()).toBeVisible({
      timeout: 15 * 1000,
    });

    // Verify we have search results with video thumbnails
    const videoResults = page
      .locator(".grid > div")
      .filter({ has: page.locator("img") });
    await expect(videoResults.first()).toBeVisible();
  });
});

test.describe.serial("Video Player Plugin: Playlist", () => {
  test.beforeEach(async ({ e2eCommand, context }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
    await stubVideoPlayerYoutube(context, [first, second, third, long]);
  });

  test("reorders and removes videos", async ({
    projectPage,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Video Player");

    for (const video of [first, second, third]) {
      await videoPlayerPlugin.addFromSearch(video.title);
    }
    await expect(videoPlayerPlugin.videos.nth(0)).toContainText(
      "YouTube • 00:05",
    );

    await videoPlayerPlugin.dragVideo("First Video", "Second Video");
    await expect(videoPlayerPlugin.videos.nth(0)).toContainText("Second Video");
    await expect(videoPlayerPlugin.videos.nth(1)).toContainText("First Video");

    await videoPlayerPlugin
      .video("Second Video")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(videoPlayerPlugin.videos).toHaveCount(2);
    await expect(videoPlayerPlugin.videos.nth(0)).toContainText("First Video");
    await expect(videoPlayerPlugin.videos.nth(1)).toContainText("Third Video");
  });

  test("stops at the end of a video with autoplay off", async ({
    projectPage,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Video Player");
    for (const video of [first, second]) {
      await videoPlayerPlugin.addFromSearch(video.title);
    }

    await videoPlayerPlugin.playVideoButton("First Video").click();
    const nowPlaying = videoPlayerPlugin.nowPlaying;
    // Off unless someone turns it on
    await expect(
      nowPlaying.getByRole("button", { name: "Autoplay off" }),
    ).toBeVisible();

    // First Video is 5s long
    await expect(nowPlaying.getByRole("button", { name: "Play" })).toBeVisible({
      timeout: 10 * 1000,
    });
    await expect(nowPlaying).toContainText("First Video");

    // Playing a finished video starts it again
    await nowPlaying.getByRole("button", { name: "Play" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();
  });

  test("plays the next video on the screen with autoplay on", async ({
    projectPage,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Video Player");
    for (const video of [first, second]) {
      await videoPlayerPlugin.addFromSearch(video.title);
    }

    const rendererPage = await projectPage.present();
    await rendererPage.waitForLoadState("networkidle");

    await videoPlayerPlugin.playVideoButton("First Video").click();
    const nowPlaying = videoPlayerPlugin.nowPlaying;
    await nowPlaying.getByRole("button", { name: "Autoplay off" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: autoplayOn }),
    ).toBeVisible();
    await expect(
      VideoPlayerPlugin.rendererVideo(rendererPage, first.videoId),
    ).toHaveCount(1);

    // First Video is 5s long, then the screen and remote follow on their own
    await expect(nowPlaying).toContainText("Second Video", {
      timeout: 10 * 1000,
    });
    await expect(
      nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();
    await expect(
      VideoPlayerPlugin.rendererVideo(rendererPage, second.videoId),
    ).toHaveCount(1);
    await expect(
      VideoPlayerPlugin.rendererVideo(rendererPage, first.videoId),
    ).toHaveCount(0);
  });

  test("repeats the whole list or a single video", async ({
    page,
    projectPage,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Video Player");
    for (const video of [first, third]) {
      await videoPlayerPlugin.addFromSearch(video.title);
    }

    await videoPlayerPlugin.playVideoButton("First Video").click();
    const nowPlaying = videoPlayerPlugin.nowPlaying;

    // Going round the list means moving through it, so autoplay comes on
    await nowPlaying.getByRole("button", { name: "Repeat off" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Repeat all videos" }),
    ).toBeVisible();
    await expect(
      nowPlaying.getByRole("button", { name: autoplayOn }),
    ).toBeVisible();

    // Both are 5s long, so it goes on to the second and back round
    await expect(nowPlaying).toContainText("Third Video", {
      timeout: 10 * 1000,
    });
    await expect(nowPlaying).toContainText("First Video", {
      timeout: 10 * 1000,
    });

    await nowPlaying.getByRole("button", { name: "Repeat all videos" }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Repeat video" }),
    ).toBeVisible();

    // Well past the end of a video, it's still on the same one
    await page.waitForTimeout(7 * 1000);
    await expect(nowPlaying).toContainText("First Video");
    await expect(
      nowPlaying.getByRole("button", { name: "Pause" }),
    ).toBeVisible();

    // Turning autoplay off leaves repeat all with nothing to go round
    await nowPlaying.getByRole("button", { name: "Repeat video" }).click();
    await nowPlaying.getByRole("button", { name: "Repeat off" }).click();
    await nowPlaying.getByRole("button", { name: autoplayOn }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Repeat off" }),
    ).toBeVisible();
  });

  test("plays faster at a higher speed", async ({
    page,
    projectPage,
    videoPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Video Player");
    for (const video of [long, second]) {
      await videoPlayerPlugin.addFromSearch(video.title);
    }

    await videoPlayerPlugin.playVideoButton("Long Video").click();
    const nowPlaying = videoPlayerPlugin.nowPlaying;
    await nowPlaying.getByRole("button", { name: "Autoplay off" }).click();

    await nowPlaying.getByRole("button", { name: "Speed 1×" }).click();
    await page.getByRole("button", { name: "2×", exact: true }).click();
    await expect(
      nowPlaying.getByRole("button", { name: "Speed 2×" }),
    ).toBeVisible();

    // Long Video is 20s long, so at 2x the next one starts in about 10s
    await expect(nowPlaying).toContainText("Second Video", {
      timeout: 14 * 1000,
    });
  });
});

// A public-link viewer (the logged-out demo lands on one) has no session. They
// can still search YouTube for a video.
test.describe("Video Player Plugin: public access", () => {
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
                  pluginName: "video-player",
                  name: "Video Player",
                  activate: true,
                  pluginData: { videos: [] },
                  rendererPluginData: { activeVideoId: null, videoStates: {} },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test("a logged-out viewer can search YouTube and add a video", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const videoPlayerPlugin = new VideoPlayerPlugin(page);
    try {
      // Answers the search in the browser, so the spec doesn't depend on
      // YouTube. The server side is covered by the next test
      await context.route(/\/trpc\/videoPlayer\.search/, (route) =>
        route.fulfill({
          status: 200,
          json: [
            {
              result: {
                data: {
                  results: [
                    {
                      type: "Video",
                      video_id: "aaaaaaaaaa1",
                      title: { text: "Public Search Result" },
                      author: { name: "Some Channel" },
                      duration: { seconds: 60 },
                      thumbnails: [
                        { url: "https://i.ytimg.com/vi/aaaaaaaaaa1/hq.jpg" },
                      ],
                      thumbnail_overlays: [],
                    },
                  ],
                  refinements: [],
                },
              },
            },
          ],
        }),
      );
      await context.route(/^https:\/\/i\.ytimg\.com\//, (route) =>
        route.fulfill({ status: 200, contentType: "image/jpeg", body: "" }),
      );

      await page.goto("/app/testorg/testproject");
      await expect(page.getByText("No videos loaded yet.")).toBeVisible();

      await videoPlayerPlugin.searchInput.fill("test video");
      await page.getByRole("button", { name: "Go" }).click();
      await page.getByRole("dialog").getByText("Public Search Result").click();

      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.getByText("Public Search Result")).toBeVisible();
      await expect(page.getByText("No videos loaded yet.")).toBeHidden();
    } finally {
      await context.close();
    }
  });
});
