import { expect, test } from "../../../../../fixtures/projectFixture";
import { VideoPlayerPlugin } from "../../../../../pages/VideoPlayerPlugin";

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
    await expect(page.getByText("Search or enter URL:")).toBeVisible();

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
