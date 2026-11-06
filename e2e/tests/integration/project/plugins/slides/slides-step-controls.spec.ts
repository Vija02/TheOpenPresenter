import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import { buildGoogleSlidesScene } from "../../../../../helpers/slidesSeed";
import {
  ORG_SLUG,
  orgUrl,
  projectUrl,
} from "../../../../../helpers/workerData";

const GOOGLE_SCENE = buildGoogleSlidesScene();
const CLICK_COUNTS = (
  Object.values(GOOGLE_SCENE.pluginData.imports)[0] as {
    slideClickCounts: number[];
  }
).slideClickCounts;

const openDeck = async (
  page: Page,
  e2eCommand: { loginWithScenes: (opts: any) => Promise<unknown> },
) => {
  await e2eCommand.loginWithScenes({
    next: orgUrl(),
    orgs: [
      {
        name: "TestOrg",
        slug: ORG_SLUG,
        projects: [
          {
            name: "TestProject",
            slug: "testproject",
            scenes: [GOOGLE_SCENE],
          },
        ],
      },
    ],
  });
  await page.goto(projectUrl());
};

test.describe("Slides step controls", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("the live slide's bar steps and jumps through builds", async ({
    page,
    e2eCommand,
  }) => {
    // The sample deck's first slide has a build; the bar needs one to show
    expect(CLICK_COUNTS[0]).toBeGreaterThan(0);

    await openDeck(page, e2eCommand);

    const live = page.locator(
      '[data-testid="slide-container"][aria-current="true"]',
    );
    const bar = live.getByTestId("slide-step-controls");
    const atStep = bar.locator('[aria-current="step"]');

    await expect(live).toHaveText(/Slide 1/);

    // Only the live slide has a bar: a line for the start, plus one per build
    await expect(page.getByTestId("slide-step-controls")).toHaveCount(1);
    await expect(bar.getByRole("button", { name: /^Go to / })).toHaveCount(
      CLICK_COUNTS[0]! + 1,
    );
    await expect(atStep).toHaveAccessibleName("Go to start");

    // Every other slide with builds says how many it has
    const othersWithBuilds = CLICK_COUNTS.slice(1).filter((c) => c > 0);
    await expect(page.getByTestId("slide-step-badge")).toHaveCount(
      othersWithBuilds.length,
    );

    // Tapping a line jumps to that build, without the card click resetting it
    await bar.getByRole("button", { name: "Go to step 1" }).click();
    await expect(atStep).toHaveAccessibleName("Go to step 1");
    await expect(live).toHaveText(/Slide 1/);

    await bar.getByRole("button", { name: "Go to start" }).click();
    await expect(atStep).toHaveAccessibleName("Go to start");

    // The arrow plays the next build...
    await bar.getByRole("button", { name: "Play next animation" }).click();
    await expect(atStep).toHaveAccessibleName("Go to step 1");
    // ...let it finish so the next press moves on rather than skipping it
    await page.waitForTimeout(1500);

    // ...and once they're all shown, goes to the next slide
    await bar.getByRole("button", { name: "Next slide" }).click();
    await expect(live).toHaveText(/Slide 2/);
  });

  test("jumps back more than one build", async ({ page, e2eCommand }) => {
    // A slide with several builds, so a jump can skip over some
    const slideIndex = CLICK_COUNTS.findIndex((c) => c >= 3);
    expect(slideIndex).toBeGreaterThanOrEqual(0);
    const builds = CLICK_COUNTS[slideIndex]!;

    await openDeck(page, e2eCommand);

    await page
      .getByTestId("slide-container")
      .filter({ hasText: `Slide ${slideIndex + 1}` })
      .click();
    const live = page.locator(
      '[data-testid="slide-container"][aria-current="true"]',
    );
    await expect(live).toHaveText(new RegExp(`Slide ${slideIndex + 1}`));

    const bar = live.getByTestId("slide-step-controls");
    const atStep = bar.locator('[aria-current="step"]');

    await bar.getByRole("button", { name: `Go to step ${builds}` }).click();
    await expect(atStep).toHaveAccessibleName(`Go to step ${builds}`);

    await bar.getByRole("button", { name: "Go to step 1" }).click();
    await expect(atStep).toHaveAccessibleName("Go to step 1");

    // Stepping on from there carries on from the build it jumped to
    await bar.getByRole("button", { name: "Play next animation" }).click();
    await expect(atStep).toHaveAccessibleName("Go to step 2");

    await bar.getByRole("button", { name: "Back" }).click();
    await expect(atStep).toHaveAccessibleName("Go to step 1");
  });

  test("the speaker view's bar steps through builds", async ({
    page,
    e2eCommand,
  }) => {
    await openDeck(page, e2eCommand);
    await page.getByRole("button", { name: "Speaker view" }).click();
    await expect(page.getByText("1 / 4")).toBeVisible();

    const bar = page
      .getByTestId("speaker-main-box")
      .getByTestId("slide-step-controls");
    const atStep = bar.locator('[aria-current="step"]');

    await expect(atStep).toHaveAccessibleName("Go to start");
    await bar.getByRole("button", { name: "Go to step 1" }).click();
    await expect(atStep).toHaveAccessibleName("Go to step 1");
    await page.waitForTimeout(1500);

    await bar.getByRole("button", { name: "Next slide" }).click();
    await expect(page.getByText("2 / 4")).toBeVisible();
  });
});
