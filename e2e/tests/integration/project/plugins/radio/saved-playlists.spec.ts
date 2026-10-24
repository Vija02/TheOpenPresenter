import { expect, test } from "../../../../../fixtures/projectFixture";
import { ORG_SLUG, projectUrl } from "../../../../../helpers/workerData";
import {
  type StubPlaylist,
  type StubVideo,
  stubYoutube,
} from "../../../../../helpers/youtubeStub";

const first: StubVideo = {
  videoId: "aaaaaaaaaa1",
  title: "First Song",
  author: "Artist One",
  duration: 60,
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

const worshipSet: StubPlaylist = {
  playlistId: "PLworshipset",
  title: "Sunday Set",
  videos: [first, second, third],
};

test.describe("Music Player Plugin: Saved playlists", () => {
  test.beforeEach(async ({ e2eCommand, context }) => {
    await e2eCommand.clearWorkerData();
    await stubYoutube(context, [first, second, third], [worshipSet]);
  });

  test("saves a playlist and loads it in another project", async ({
    page,
    e2eCommand,
    projectPage,
    musicPlayerPlugin,
  }) => {
    await e2eCommand.login({
      orgs: [
        {
          name: "TestOrg",
          slug: ORG_SLUG,
          projects: [
            { name: "TestProject", slug: "testproject" },
            { name: "OtherProject", slug: "otherproject" },
          ],
        },
      ],
      next: projectUrl(),
    });
    await projectPage.createPlugin("Music Player");

    await musicPlayerPlugin.submit(
      `https://www.youtube.com/playlist?list=${worshipSet.playlistId}`,
    );
    await expect(musicPlayerPlugin.tracks).toHaveCount(3);
    const bar = page.getByTestId("saved-playlist-bar");
    await expect(bar).toContainText("Name this playlist...");

    await bar.getByRole("button", { name: "Save", exact: true }).click();
    await bar.getByLabel("Playlist name").fill("Prelude");
    await bar.getByRole("button", { name: "Save", exact: true }).click();
    await expect(bar).toContainText("Prelude");
    await expect(bar).toContainText("Saved");

    // Edits are tracked against what was saved
    await musicPlayerPlugin
      .track("Third Song")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(bar).toContainText("Edited");
    await bar.getByRole("button", { name: "Save changes" }).click();
    await expect(bar).toContainText("Saved");

    await page.goto(projectUrl(ORG_SLUG, "otherproject"));
    await projectPage.createPlugin("Music Player");

    const quickStart = page.getByTestId("saved-playlist-quick-start");
    await expect(quickStart).toHaveCount(1);
    await expect(quickStart).toContainText("Prelude");
    await expect(quickStart).toContainText("2 tracks • 03:00");
    await quickStart.click();

    await expect(musicPlayerPlugin.tracks).toHaveCount(2);
    await expect(musicPlayerPlugin.tracks.first()).toContainText("First Song");
    await expect(bar).toContainText("Prelude");
    await expect(bar).toContainText("Saved");
  });

  test("adds, replaces, renames and deletes from the saved list", async ({
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
    const bar = page.getByTestId("saved-playlist-bar");
    // Naming it from the title saves it too
    await bar.getByRole("button", { name: "Name this playlist" }).click();
    await bar.getByLabel("Playlist name").fill("Sunday");
    await bar.getByLabel("Playlist name").press("Enter");
    await expect(bar).toContainText("Saved");

    await page.getByRole("button", { name: "Saved playlists" }).click();
    const dialog = page.getByRole("dialog", { name: "Saved playlists" });
    await expect(dialog.getByTestId("saved-playlist-row")).toContainText(
      "Sunday",
    );
    // The first playlist opens beside the list, tracks and all
    await expect(dialog.getByRole("heading", { name: "Sunday" })).toBeVisible();
    await expect(dialog.getByRole("listitem")).toHaveCount(3);

    // Appending the same playlist again makes it differ from what's saved
    await dialog.getByRole("button", { name: "Add to end" }).click();
    await expect(dialog.getByRole("button", { name: "Added" })).toBeVisible();
    await expect(musicPlayerPlugin.tracks).toHaveCount(6);

    await dialog.getByTitle("Rename").click();
    await dialog.getByLabel("Playlist name").fill("Sunday Morning");
    await dialog.getByLabel("Playlist name").press("Enter");
    await expect(
      dialog.getByRole("heading", { name: "Sunday Morning" }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Load playlist" }).click();
    await page.getByTestId("popconfirm-confirm").click();
    await expect(dialog).toBeHidden();
    await expect(musicPlayerPlugin.tracks).toHaveCount(3);
    await expect(bar).toContainText("Sunday Morning");
    await expect(bar).toContainText("Saved");

    await page.getByRole("button", { name: "Saved playlists" }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await page.getByTestId("popconfirm-confirm").click();
    await expect(dialog.getByText("No saved playlists yet")).toBeVisible();
    await page.keyboard.press("Escape");

    // The scene keeps its tracks, just no longer linked
    await expect(musicPlayerPlugin.tracks).toHaveCount(3);
    await expect(bar).toContainText("Name this playlist...");
  });

  test("renames from the title and saves a copy", async ({
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
    const bar = page.getByTestId("saved-playlist-bar");
    await bar.getByRole("button", { name: "Save", exact: true }).click();
    await bar.getByLabel("Playlist name").fill("Evening");
    await bar.getByRole("button", { name: "Save", exact: true }).click();
    await expect(bar.getByTitle("Rename")).toHaveText("Evening");

    await bar.getByTitle("Rename").click();
    await bar.getByLabel("Playlist name").fill("Evening Service");
    await bar.getByLabel("Playlist name").press("Enter");
    await expect(bar.getByTitle("Rename")).toHaveText("Evening Service");

    await musicPlayerPlugin
      .track("Third Song")
      .getByRole("button", { name: "Remove" })
      .click();
    await bar.getByRole("button", { name: "Playlist options" }).click();
    await page.getByRole("button", { name: /Save a copy/ }).click();
    await expect(bar.getByLabel("Playlist name")).toBeFocused();
    await bar.getByLabel("Playlist name").fill("Evening Short");
    await bar.getByRole("button", { name: "Save", exact: true }).click();
    await expect(bar.getByTitle("Rename")).toHaveText("Evening Short");
    await expect(bar).toContainText("Saved");

    // The original is untouched
    await page.getByRole("button", { name: "Saved playlists" }).click();
    const rows = page.getByTestId("saved-playlist-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Evening Service" })).toContainText(
      "3 tracks",
    );
    await expect(rows.filter({ hasText: "Evening Short" })).toContainText(
      "2 tracks",
    );
  });

  test("discards changes and clears tracks from the menu", async ({
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
    const bar = page.getByTestId("saved-playlist-bar");
    await bar.getByRole("button", { name: "Save", exact: true }).click();
    await bar.getByLabel("Playlist name").fill("Morning");
    await bar.getByRole("button", { name: "Save", exact: true }).click();
    await expect(bar).toContainText("Saved");
    // Nothing to save while it matches
    await expect(bar.getByRole("button", { name: /Save/ })).toHaveCount(0);

    await musicPlayerPlugin
      .track("First Song")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(bar).toContainText("Edited");
    await bar.getByRole("button", { name: "Playlist options" }).click();
    await page.getByRole("button", { name: /Discard changes/ }).click();
    await expect(musicPlayerPlugin.tracks).toHaveCount(3);
    await expect(bar).toContainText("Saved");

    await bar.getByRole("button", { name: "Playlist options" }).click();
    await page.getByRole("button", { name: /Clear tracks/ }).click();
    await expect(page.getByText("Clear all 3 tracks?")).toBeVisible();
    await page
      .locator("[data-slot=popover-content]")
      .getByRole("button", { name: "Clear", exact: true })
      .click();
    await expect(musicPlayerPlugin.tracks).toHaveCount(0);

    // A fresh start, with the saved one a click away
    await expect(page.getByTestId("saved-playlist-quick-start")).toContainText(
      "Morning",
    );
    await musicPlayerPlugin.submit(
      `https://www.youtube.com/playlist?list=${worshipSet.playlistId}`,
    );
    await expect(bar).toContainText("Name this playlist...");
  });
});
