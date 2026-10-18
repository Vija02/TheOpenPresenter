import { expect, test } from "../../../../../fixtures/projectFixture";
import {
  type StubSpotifyCollection,
  stubSpotify,
} from "../../../../../helpers/spotifyStub";
import { stubYoutube } from "../../../../../helpers/youtubeStub";

const playlistId = "37i9dQZF1DXcBWIGoYBM5M";

const sundaySet: StubSpotifyCollection = {
  id: playlistId,
  name: "Sunday Set",
  tracks: [
    { title: "Way Maker", artist: "Leeland", duration: 300 },
    { title: "Goodness of God", artist: "Bethel Music", duration: 296 },
    { title: "Oceans", artist: "Hillsong UNITED", duration: 535 },
    { title: "Unknown Song", artist: "Nobody", duration: 200 },
  ],
};

const candidates = {
  "Way Maker": [
    {
      videoId: "aaaaaaaaaa1",
      title: "Leeland - Way Maker (Official Audio)",
      author: "Leeland",
      duration: 301,
      score: 0.95,
    },
  ],
  // Unsure, with a better one further down
  "Goodness of God": [
    {
      videoId: "bbbbbbbbbb1",
      title: "Goodness of God (Live)",
      author: "Some Church",
      duration: 330,
      score: 0.55,
    },
    {
      videoId: "bbbbbbbbbb2",
      title: "Bethel Music - Goodness of God",
      author: "Bethel Music",
      duration: 296,
      score: 0.5,
    },
  ],
  // Likely the wrong song
  Oceans: [
    {
      videoId: "cccccccccc1",
      title: "Ocean Sounds for Sleep",
      author: "Relax",
      duration: 3600,
      score: 0.2,
    },
  ],
};

test.describe.serial("Music Player Plugin: Spotify import", () => {
  test.beforeEach(async ({ e2eCommand, context }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
    await stubYoutube(context, []);
    await stubSpotify(context, [sundaySet], candidates);
  });

  test("matches a Spotify playlist on YouTube to check before adding", async ({
    page,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    await musicPlayerPlugin.submit(
      `https://open.spotify.com/playlist/${playlistId}?si=share`,
    );
    const dialog = page.getByRole("dialog", { name: "Import from Spotify" });
    await expect(dialog).toContainText("Sunday Set • 4 tracks");

    const rows = dialog.getByTestId("spotify-import-row");
    await expect(rows).toHaveCount(4);
    const row = (title: string) => rows.filter({ hasText: title });

    // Confident matches are picked, unsure ones flagged, unlikely ones left out
    await expect(row("Way Maker").getByRole("checkbox")).toBeChecked();
    await expect(row("Way Maker")).not.toContainText("Check this");
    await expect(row("Goodness of God")).toContainText("Check this");
    await expect(row("Goodness of God").getByRole("checkbox")).toBeChecked();
    await expect(row("Oceans").getByRole("checkbox")).not.toBeChecked();
    await expect(row("Unknown Song")).toContainText("Not found on YouTube");
    await expect(row("Unknown Song").getByRole("checkbox")).toBeDisabled();
    await expect(dialog).toContainText("2 of 4 selected");

    await row("Goodness of God")
      .getByRole("button", { name: "Other matches" })
      .click();
    await page
      .getByRole("button", { name: /Bethel Music - Goodness of God/ })
      .click();
    await expect(row("Goodness of God")).toContainText(
      "Bethel Music - Goodness of God",
    );

    await dialog.getByRole("button", { name: "Add 2 tracks" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Added 2 tracks from Spotify.")).toBeVisible();

    // Named as on Spotify, playing the chosen upload
    await expect(musicPlayerPlugin.tracks).toHaveCount(2);
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText("Way Maker");
    await expect(musicPlayerPlugin.tracks.nth(0)).toContainText("Leeland");
    await expect(musicPlayerPlugin.tracks.nth(1)).toContainText(
      "Goodness of God",
    );
    await expect(
      musicPlayerPlugin.track("Goodness of God").locator("img"),
    ).toHaveAttribute("src", /bbbbbbbbbb2/);
  });

  test("says when a Spotify link can't be read", async ({
    page,
    projectPage,
    musicPlayerPlugin,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Music Player");

    await musicPlayerPlugin.submit(
      "https://open.spotify.com/playlist/0000000000000000000000",
    );
    const dialog = page.getByRole("dialog", { name: "Import from Spotify" });
    await expect(
      dialog.getByText("Couldn't read that Spotify link. It may be private."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(musicPlayerPlugin.tracks).toHaveCount(0);
  });
});
