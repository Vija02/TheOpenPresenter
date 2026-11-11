import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/aiFixture";
import type { LyricsPlugin } from "../../../../../pages/LyricsPlugin";
import type { ProjectPage } from "../../../../../pages/ProjectPage";

/**
 * Laying a song out on slides from the song editor: the plain 2 and 4 line
 * splits, AI formatting through the server, and what the button offers when
 * AI can't run for the organization.
 *
 * The AI tests put `fakeAi.marker` in the song, which is how the fake tells
 * this test's requests from any other running in parallel.
 */

/** Opens "Create new song" with `content` typed into the editor. */
const openNewSong = async (
  {
    loginAndGoToProject,
    projectPage,
    lyricsPlugin,
  }: {
    loginAndGoToProject: () => Promise<void> | void;
    projectPage: ProjectPage;
    lyricsPlugin: LyricsPlugin;
  },
  content: string,
) => {
  await loginAndGoToProject();
  await projectPage.createPlugin("Lyrics Presenter");
  const dialog = await lyricsPlugin.openAddModal();
  await dialog.getByRole("button", { name: "Create new song" }).click();

  const editor = dialog
    .getByTestId("ly-song-editor")
    .locator('[contenteditable="true"]');
  await editor.click();
  await editor.press("ControlOrMeta+a");
  await editor.press("Backspace");
  await editor.pressSequentially(content);
  return { dialog, editor };
};

const linesOf = async (editor: { innerText: () => Promise<string> }) =>
  (await editor.innerText()).split("\n").filter(Boolean);

/** Answers the AI status check with `status`, as a server would. */
const stubAiStatus = (page: Page, status: object) =>
  page.route("**/ai/status?*", (route) => route.fulfill({ json: status }));

// Each test logs in to a fresh copy of this worker's org.
test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

test.describe("Lyrics formatting", () => {
  test("splits a section into slides of two lines without AI", async ({
    page,
    loginAndGoToProject,
    projectPage,
    lyricsPlugin,
  }) => {
    // The split is the same either way; this pins which menu it is in.
    await stubAiStatus(page, { state: "available" });
    const { dialog, editor } = await openNewSong(
      { loginAndGoToProject, projectPage, lyricsPlugin },
      "[Verse]\nOne\nTwo\nThree\nFour",
    );

    await dialog.getByRole("button", { name: "More ways to format" }).click();
    await page.getByRole("button", { name: "2 lines per slide" }).click();

    await expect
      .poll(() => linesOf(editor))
      .toEqual(["[Verse]", "One", "Two", "-", "Three", "Four"]);
  });

  test("formats with AI through the server's lyrics model", async ({
    loginAndGoToProject,
    projectPage,
    lyricsPlugin,
    fakeAi,
    requireFakeAi,
  }) => {
    await requireFakeAi("lyrics.format");
    await fakeAi.script([
      { content: "[Verse 1]\nAmazing grace\n-\nHow sweet the sound" },
    ]);

    const { dialog, editor } = await openNewSong(
      { loginAndGoToProject, projectPage, lyricsPlugin },
      `Verse 1\nAmazing grace how sweet the sound ${fakeAi.marker}`,
    );
    await dialog.getByRole("button", { name: "AI Format" }).click();

    await expect
      .poll(() => linesOf(editor))
      .toEqual(["[Verse 1]", "Amazing grace", "-", "How sweet the sound"]);

    const [sent] = await fakeAi.requests();
    // No model named in code: the server's AI_MODEL, through the profile.
    expect(sent?.model).toBe("fake-model");
    expect(sent?.userText).toContain("Amazing grace how sweet the sound");
  });

  test("sends custom instructions along with the song", async ({
    page,
    loginAndGoToProject,
    projectPage,
    lyricsPlugin,
    fakeAi,
    requireFakeAi,
  }) => {
    await requireFakeAi("lyrics.format");
    await fakeAi.script([{ content: "[Verse 1]\nAmazing grace" }]);

    const { dialog } = await openNewSong(
      { loginAndGoToProject, projectPage, lyricsPlugin },
      `Verse 1\nAmazing grace ${fakeAi.marker}`,
    );
    await dialog.getByRole("button", { name: "More ways to format" }).click();
    await page.getByRole("button", { name: /Custom AI/ }).click();

    const ask = page.getByRole("dialog", { name: "Format with AI" });
    await ask.getByRole("textbox").fill("Delete the intro");
    await ask.getByRole("button", { name: "Format", exact: true }).click();

    await expect.poll(async () => (await fakeAi.requests()).length).toBe(1);
    const [sent] = await fakeAi.requests();
    expect(sent?.userText).toMatch(/Delete the intro[\s\S]*Amazing grace/);
  });

  test("shows why AI formatting failed, and keeps the song", async ({
    page,
    loginAndGoToProject,
    projectPage,
    lyricsPlugin,
    fakeAi,
    requireFakeAi,
  }) => {
    await requireFakeAi("lyrics.format");
    await fakeAi.script([{ errorStatus: 500 }]);

    const { dialog, editor } = await openNewSong(
      { loginAndGoToProject, projectPage, lyricsPlugin },
      `Verse 1\nAmazing grace ${fakeAi.marker}`,
    );
    await dialog.getByRole("button", { name: "AI Format" }).click();

    // The open dialog hides the toast from the accessibility tree.
    await expect(
      page.getByRole("alert", { includeHidden: true }),
    ).toBeVisible();
    await expect(editor).toContainText("Amazing grace");
  });
});

test.describe("Lyrics formatting without AI", () => {
  test("offers the splits, and explains AI with a way to connect", async ({
    page,
    loginAndGoToProject,
    projectPage,
    lyricsPlugin,
  }) => {
    await stubAiStatus(page, {
      state: "connect",
      actionUrl: "/o/somewhere/cloud",
    });
    const { dialog, editor } = await openNewSong(
      { loginAndGoToProject, projectPage, lyricsPlugin },
      "[Verse]\nOne\nTwo",
    );

    // One menu, not the AI split button.
    await expect(dialog.getByRole("button", { name: "AI Format" })).toHaveCount(
      0,
    );
    await dialog.getByRole("button", { name: "Format", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "2 lines per slide" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^AI Format/ }).click();

    const explain = page.getByRole("dialog", { name: "Connect to use AI" });
    await expect(explain).toContainText(
      "AI works through TheOpenPresenter Cloud.",
    );

    // In a new tab, so the song being written here is kept.
    const popup = page.waitForEvent("popup");
    await explain.getByRole("button", { name: "Connect to Cloud" }).click();
    expect((await popup).url()).toContain("/o/somewhere/cloud");
    await expect(editor).toContainText("One");
  });

  test("only explains when offline", async ({
    page,
    loginAndGoToProject,
    projectPage,
    lyricsPlugin,
  }) => {
    await stubAiStatus(page, { state: "offline" });
    const { dialog } = await openNewSong(
      { loginAndGoToProject, projectPage, lyricsPlugin },
      "[Verse]\nOne",
    );

    await dialog.getByRole("button", { name: "Format", exact: true }).click();
    await page.getByRole("button", { name: /^AI Format/ }).click();

    const explain = page.getByRole("dialog", { name: "You're offline" });
    await expect(explain).toContainText("AI needs an internet connection.");
    await expect(
      explain.getByRole("button", { name: /Connect|Reconnect|Upgrade/ }),
    ).toHaveCount(0);
  });
});
