import type { Page } from "@playwright/test";

import { expect, test } from "../../../fixtures/screenFixture";
import {
  SAMPLE_SPEAKER_NOTES,
  buildGoogleSlidesScene,
} from "../../../helpers/slidesSeed";
import { ProjectPage } from "../../../pages/ProjectPage";
import { RendererScreenPage } from "../../../pages/Renderer/RendererScreenPage";

/**
 * Confidence monitors: a text element reads live plugin values through a named
 * feed, as `{{<feed>.<key>}}`.
 *
 * The offset lives on the feed's derivation, so "next slide's notes" is a
 * second feed rather than new token syntax. These specs assert on the NOTES
 * TEXT itself, which differs per slide, so a feed that silently resolved to
 * nothing cannot pass.
 */

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-feeds-${WORKER_TAG}`;
const SCREEN_SLUG = `testscreen-feeds-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Feeds ${WORKER_TAG}`;
const SCREEN_NAME = `Feeds Test Screen ${WORKER_TAG}`;
const USERNAME = `testuser_feeds_${WORKER_TAG}`;
const PROJECT_NAME = "Feeds Source Project";
const PROJECT_SLUG = "feeds-source-project";

const [FIRST_NOTE, SECOND_NOTE] = SAMPLE_SPEAKER_NOTES;

// The seeded deck embeds the whole sample embed HTML, too large for the
// GET-based `login`.
const login = (e2eCommand: any) =>
  e2eCommand.loginWithScenes({
    username: USERNAME,
    orgs: [
      {
        name: ORG_NAME,
        slug: ORG_SLUG,
        owner: true,
        projects: [
          {
            name: PROJECT_NAME,
            slug: PROJECT_SLUG,
            scenes: [buildGoogleSlidesScene()],
          },
        ],
      },
    ],
  });

const openLayoutEditor = async (page: Page) => {
  await page.getByRole("button", { name: "Manage Renderers" }).click();
  await expect(page.getByText("Manage Renderers")).toBeVisible();
  await page.getByRole("checkbox", { name: "Use custom layout" }).check();
  await page.getByRole("button", { name: "Configure" }).click();
  await expect(page.getByText(/Layout Settings/)).toBeVisible();
};

const addFeed = async (page: Page) => {
  await page.getByRole("button", { name: "+ Add feed" }).click();
};

/** The control belonging to a labelled inspector Row. */
const rowInput = (page: Page, label: string) =>
  page
    .locator("div.grid")
    .filter({ has: page.locator(`span:text-is("${label}")`) })
    .getByRole("textbox")
    .first();

/** The only textarea in the inspector; "Content" is a section heading. */
const contentBox = (page: Page) => page.locator("textarea").first();

const addTextElement = async (page: Page, content: string) => {
  await page.getByRole("button", { name: "Add text" }).click();
  await expect(contentBox(page)).toBeVisible();
  await contentBox(page).fill(content);
  await contentBox(page).blur();
};

/**
 * The inspector shows the selected element, so the Data feeds panel is only
 * reachable with nothing selected. Clicking the canvas padding clears it.
 */
const deselect = async (page: Page) => {
  await page
    .locator(".lay--workbench-canvas")
    .click({ position: { x: 4, y: 4 } });
  await expect(page.getByText("Data feeds")).toBeVisible();
};

const closeLayoutEditor = async (page: Page) => {
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Close" }).first().click();
  await expect(page.getByRole("dialog")).toBeHidden();
};

test.describe.serial("Layout feeds", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("offers the tokens the slides plugin publishes", async ({
    page,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);
    await addFeed(page);

    // Declared by plugins/slides/src/bindings.ts and carried to the editor
    // over GraphQL, so this fails if the plugin registered nothing.
    await expect(page.getByText("{{feed.notes}}")).toBeVisible();
    await expect(
      page.getByText("This source publishes no values."),
    ).toBeHidden();
  });

  test("renders live notes on the screen through a feed token", async ({
    page,
    context,
    e2eCommand,
    setupScreen,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      name: SCREEN_NAME,
    });

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);

    await addFeed(page);
    await addTextElement(page, "NOW: {{feed.notes}}");
    await closeLayoutEditor(page);

    const rendererPage = await context.newPage();
    try {
      const renderer = new RendererScreenPage(rendererPage);
      await renderer.goto(ctx.orgSlug, ctx.screenSlug);

      const projectPage = new ProjectPage(page, context);
      await projectPage.openPresentMenu();
      await projectPage.presentScreenOption(SCREEN_NAME).click();

      // The seeded deck sits on slide one, so this is the live note and NOT
      // the next one: a feed resolving to the wrong slide fails here.
      await expect(
        rendererPage.getByText(`NOW: ${FIRST_NOTE}`).first(),
      ).toBeVisible();
    } finally {
      await rendererPage.close();
    }
  });

  test("a feed offset by one shows the next slide's notes", async ({
    page,
    context,
    e2eCommand,
    setupScreen,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);
    const ctx = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: SCREEN_SLUG,
      name: SCREEN_NAME,
    });

    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);

    await addFeed(page);

    // Offset lives on the feed's derivation, the same field a host element
    // uses, rather than being encoded in the token.
    //
    // It counts STEPS, not slides: slide one of the sample deck has one click
    // build, so two steps forward is what lands on slide two.
    const offset = rowInput(page, "Step offset");
    await offset.fill("2");
    await offset.blur();
    await expect(offset).toHaveValue("2");
    await addTextElement(page, "NEXT: {{feed.notes}}");

    await closeLayoutEditor(page);

    const rendererPage = await context.newPage();
    try {
      const renderer = new RendererScreenPage(rendererPage);
      await renderer.goto(ctx.orgSlug, ctx.screenSlug);

      const projectPage = new ProjectPage(page, context);
      await projectPage.openPresentMenu();
      await projectPage.presentScreenOption(SCREEN_NAME).click();

      // The discriminating assertion: slide two's note, not slide one's.
      await expect(
        rendererPage.getByText(`NEXT: ${SECOND_NOTE}`).first(),
      ).toBeVisible();
      await expect(rendererPage.getByText(`NEXT: ${FIRST_NOTE}`)).toHaveCount(
        0,
      );
    } finally {
      await rendererPage.close();
    }
  });

  test("renaming a feed keeps the token pointing at it", async ({
    page,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);

    await addFeed(page);
    await addTextElement(page, "NOW: {{feed.notes}}");

    // Rename via the Data feeds panel, which rewrites matching tokens.
    await deselect(page);
    const nameBox = rowInput(page, "Name");
    await nameBox.fill("live");
    await nameBox.blur();

    // The chip list now advertises the new namespace...
    await expect(page.getByText("{{live.notes}}")).toBeVisible();

    // ...and the text element was rewritten rather than left dangling.
    await page.locator("[data-lay-id]").first().click();
    await expect(contentBox(page)).toHaveValue("NOW: {{live.notes}}");
  });
});
