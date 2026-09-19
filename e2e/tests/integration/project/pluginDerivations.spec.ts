import type { Page } from "@playwright/test";

import { expect, test } from "../../../fixtures/screenFixture";
import { buildGoogleSlidesScene } from "../../../helpers/slidesSeed";

/**
 * Derivations are declared by the plugin, so the controls in the layout
 * inspector are whatever `slides` registered, not a fixed Previous/Next list.
 */

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-deriv-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Deriv ${WORKER_TAG}`;
const USERNAME = `testuser_deriv_${WORKER_TAG}`;
const PROJECT_NAME = "Deriv Source Project";
const PROJECT_SLUG = "deriv-source-project";

// The seeded deck embeds the whole sample embed HTML, which is far too large
// for the GET-based `login`. `loginWithScenes` POSTs it instead.
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

const addSlidesHostElement = async (page: Page) => {
  await page.getByRole("button", { name: "Add live content" }).click();
  await page.getByRole("button", { name: "Slides" }).first().click();
  await expect(page.locator("[data-lay-host]").first()).toBeVisible();
  await expect(page.getByText("Live content")).toBeVisible();
};

// The inspector's NumberInput renders as a textbox, and there are many others
// on the canvas rows, so scope to the labelled row.
const offsetInput = (page: Page) =>
  page
    .locator("div")
    .filter({ hasText: /^Step offset$/ })
    .locator("..")
    .getByRole("textbox")
    .first();

test.describe.serial("Plugin-declared derivations", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("shows the slides plugin's own controls", async ({
    page,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);
    await addSlidesHostElement(page);

    // Declared by plugins/slides/src/derivation.ts.
    await expect(page.getByText("Step offset")).toBeVisible();
  });

  test("clamps an out-of-range offset typed into the box", async ({
    page,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await openLayoutEditor(page);
    await addSlidesHostElement(page);

    const offset = offsetInput(page);
    await offset.fill("999");
    await offset.blur();

    // max is 20 in the declared field, and clamping happens on write.
    await expect(offset).toHaveValue("20");
  });
});
