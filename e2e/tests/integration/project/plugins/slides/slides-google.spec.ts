import type { Page } from "@playwright/test";

import { E2ECommandAPI } from "../../../../../e2eCommand";
import { expect, test } from "../../../../../fixtures/projectFixture";
import {
  SAMPLE_SLIDE_AUTOPLAY_DURATIONS,
  SAMPLE_SLIDE_TRANSITION_DURATIONS,
  pressSettle,
  pressSkip,
  reachSlide,
} from "../../../../../helpers/slidesRenderer";
import { buildGoogleSlidesScene } from "../../../../../helpers/slidesSeed";
import { ProjectPage } from "../../../../../pages/ProjectPage";

// Drives the live Google Slides embed through one continuous journey
const SLIDE_2 = 1;
const SLIDE_3 = 2;

const SCENE = buildGoogleSlidesScene();
const IMPORT_ID = Object.keys(SCENE.pluginData.imports)[0];
const CLICKS: number[] = SCENE.pluginData.imports[IMPORT_ID].slideClickCounts;
const SHOT = { maxDiffPixelRatio: 0.02 } as const;

function settleMsForSlide(slideIndex: number): number {
  return Math.max(
    SAMPLE_SLIDE_TRANSITION_DURATIONS[slideIndex] ?? 0,
    SAMPLE_SLIDE_AUTOPLAY_DURATIONS[slideIndex] ?? 0,
  );
}

async function openDeck(
  page: Page,
  projectPage: ProjectPage,
  e2eCommand: E2ECommandAPI,
): Promise<Page> {
  await e2eCommand.loginWithScenes({
    next: "/o/testorg",
    orgs: [
      {
        name: "TestOrg",
        slug: "testorg",
        projects: [
          { name: "TestProject", slug: "testproject", scenes: [SCENE] },
        ],
      },
    ],
  });
  await page.goto("/app/testorg/testproject");
  const presentedPage = await projectPage.present();
  await expect(presentedPage.locator("iframe")).toBeVisible({
    timeout: 30 * 1000,
  });
  await presentedPage.click("body");
  await presentedPage.waitForLoadState("networkidle");
  return presentedPage;
}

test.describe("Slides Plugin - Google Slides renderer", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("renderer tracks build, transition & backward navigation end to end", async ({
    page,
    projectPage,
    e2eCommand,
  }) => {
    const pp = await openDeck(page, projectPage, e2eCommand);
    const frame = pp.locator("iframe");
    const shot = (name: string) => expect(frame).toHaveScreenshot(name, SHOT);

    // ── Slide 2: the -1 autoplay rewind ──────────────────────────────────
    await reachSlide(page, SLIDE_2);
    await pp.waitForTimeout(900 + 50);

    await shot("s2-c0.png");
    // Left at click 0 on an autoplay slide rewinds (click -1) instead of
    // crossing back to slide 1.
    await pressSettle(pp, "ArrowLeft", 50);
    await shot("s2-rewind.png");
    await pressSettle(pp, "ArrowRight", 900 + 50); // exit the rewind, back to click 0
    await shot("s2-c0-repeat.png");

    // ── Skip the slide 2 -> 3 transition ─────────────────────────────────
    for (let c = 1; c <= CLICKS[SLIDE_2]; c++)
      await pressSettle(pp, "ArrowRight", 50);
    await pressSkip(pp, "ArrowRight", "ArrowRight"); // start transition, skip it
    await pressSettle(pp, "ArrowLeft", 50); // skip lands mid-build; settle to click 0
    await shot("s3-c0.png"); // now on slide 3

    // ── Slide 3: step builds Right then Left ─────────────────────────────
    for (let c = 1; c <= CLICKS[SLIDE_3]; c++)
      await pressSettle(
        pp,
        "ArrowRight",
        CLICKS[SLIDE_3] === c ? settleMsForSlide(SLIDE_3) : 50,
      );
    await shot("s3-built.png");
    for (let c = 1; c <= CLICKS[SLIDE_3]; c++)
      await pressSettle(pp, "ArrowLeft", 50);
    await shot("s3-c0-repeat.png");

    // ── Cross into slide 4 (autoplay) ────────────────────────────────────
    for (let c = 1; c <= CLICKS[SLIDE_3] + 1; c++)
      await pressSettle(pp, "ArrowRight", 50);
    await pressSettle(pp, "ArrowRight", 700 + 50);
    await shot("s4-c0.png");

    // ── Reverse 4 -> 3 transition: Right cancels, Left finishes ───────────
    // Slide 4 has autoplay, so Left first rewinds click 0 -> -1 (still slide 4).
    await pressSettle(pp, "ArrowLeft", 50);
    // Start the reverse transition, then Right cancels it — back to slide 4's
    // -1 sub-state.
    await pressSkip(pp, "ArrowLeft", "ArrowRight");
    await shot("s4-cancel-rewind.png");
    // Start it again, and this time Left finishes the reverse onto slide 3.
    await pressSkip(pp, "ArrowLeft", "ArrowLeft");
    await shot("s4to3-finish.png");
  });
});
