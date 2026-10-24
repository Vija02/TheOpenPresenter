import type { Page } from "@playwright/test";

import { E2ECommandAPI } from "../../../../../e2eCommand";
import { expect, test } from "../../../../../fixtures/projectFixture";
import { pressSettle, reachSlide } from "../../../../../helpers/slidesRenderer";
import {
  buildPowerPointScene,
  routeOfficeSprites,
} from "../../../../../helpers/slidesSeed";
import {
  ORG_SLUG,
  orgUrl,
  projectUrl,
} from "../../../../../helpers/workerData";
import { ProjectPage } from "../../../../../pages/ProjectPage";

// Plays a PowerPoint import captured from PowerPoint for the web, with our own
// renderer. Seeded rather than imported, so it needs no tunnel or Office Online.
const STILL = 0; // followed by a slide that fades in
const MORPH_FROM = 2;
const MORPH_TO = 3;
const ENTRANCES = 4;
const PARAGRAPHS = 5;

const SCENE = buildPowerPointScene();
const SHOT = { maxDiffPixelRatio: 0.02 } as const;

async function openDeck(
  page: Page,
  projectPage: ProjectPage,
  e2eCommand: E2ECommandAPI,
): Promise<Page> {
  await routeOfficeSprites(page.context());
  await e2eCommand.loginWithScenes({
    next: orgUrl(),
    orgs: [
      {
        name: "TestOrg",
        slug: ORG_SLUG,
        projects: [
          { name: "TestProject", slug: "testproject", scenes: [SCENE] },
        ],
      },
    ],
  });
  await page.goto(projectUrl());
  const presentedPage = await projectPage.present();
  await expect(presentedPage.getByTestId("office-slide")).toBeVisible({
    timeout: 30 * 1000,
  });
  await presentedPage.click("body");
  await presentedPage.waitForLoadState("networkidle");
  return presentedPage;
}

/** Jumps from the remote; a jump lands settled, without animating */
async function jumpTo(page: Page, pp: Page, slide: number) {
  await reachSlide(page, slide);
  await pp.waitForTimeout(300);
}

test.describe("Slides Plugin - PowerPoint renderer", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("plays builds, transitions and morph", async ({
    page,
    projectPage,
    e2eCommand,
  }) => {
    const pp = await openDeck(page, projectPage, e2eCommand);
    const shot = (name: string) => expect(pp).toHaveScreenshot(name, SHOT);

    // ── Entrances: appear, fly, wipe, zoom, float, one click each ─────────
    await jumpTo(page, pp, ENTRANCES);
    await shot("entrances-c0.png"); // only the title, everything waits offstage
    await pressSettle(pp, "ArrowRight", 600);
    await pressSettle(pp, "ArrowRight", 600);
    await shot("entrances-c2.png");
    for (let c = 3; c <= 5; c++) await pressSettle(pp, "ArrowRight", 1200);
    await shot("entrances-all.png");
    // Back is instant: the last build goes away without playing
    await pressSettle(pp, "ArrowLeft", 100);
    await shot("entrances-c4.png");

    // ── Paragraph build, one bullet per click ─────────────────────────────
    await jumpTo(page, pp, PARAGRAPHS);
    await pressSettle(pp, "ArrowRight", 600);
    await pressSettle(pp, "ArrowRight", 600);
    await shot("paragraphs-c2.png");

    // ── Fade transition into the next slide ───────────────────────────────
    await jumpTo(page, pp, STILL);
    await pressSettle(pp, "ArrowRight", 1200);
    await shot("fade-landed.png");

    // ── Morph: the text made of letter pieces stays after it plays ────────
    await jumpTo(page, pp, MORPH_FROM);
    await shot("morph-from.png");
    await pressSettle(pp, "ArrowRight", 2300);
    await shot("morph-landed.png");
    await jumpTo(page, pp, MORPH_TO);
    await shot("morph-landed.png"); // landing cold looks the same
  });
});
