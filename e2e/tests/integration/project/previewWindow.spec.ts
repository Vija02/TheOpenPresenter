import { expect, test } from "../../../fixtures/screenFixture";
import { ProjectPage } from "../../../pages/ProjectPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-preview-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Preview ${WORKER_TAG}`;
const USERNAME = `testuser_preview_${WORKER_TAG}`;
const PROJECT_NAME = "Preview Source Project";
const PROJECT_SLUG = "preview-source-project";

const login = (e2eCommand: any) =>
  e2eCommand.login({
    username: USERNAME,
    orgs: [
      {
        name: ORG_NAME,
        slug: ORG_SLUG,
        owner: true,
        projects: [{ name: PROJECT_NAME, slug: PROJECT_SLUG }],
      },
    ],
  });

test.describe("Preview window", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("opens a muted renderer preview and closes again", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    await expect(projectPage.previewWindow).toBeHidden();

    await projectPage.openPreviewWindow();

    // preview=1 is what makes the renderer start silent and drop its own
    // fullscreen button, so it's the flag worth asserting on.
    await expect(projectPage.previewFrame).toHaveAttribute(
      "src",
      new RegExp(`/render/${ORG_SLUG}/${PROJECT_SLUG}.*preview=1`),
    );

    await projectPage.previewCloseButton.click();
    await expect(projectPage.previewWindow).toBeHidden();
  });

  test("starts muted and toggles", async ({ page, context, e2eCommand }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPreviewWindow();

    // The renderer installs its mute before any plugin runs, so the control
    // starts offering to unmute.
    await expect(projectPage.previewMuteButton).toHaveAttribute(
      "aria-label",
      "Unmute",
    );

    await projectPage.previewMuteButton.click();
    await expect(projectPage.previewMuteButton).toHaveAttribute(
      "aria-label",
      "Mute",
    );

    await projectPage.previewMuteButton.click();
    await expect(projectPage.previewMuteButton).toHaveAttribute(
      "aria-label",
      "Unmute",
    );
  });

  test("can be dragged by its header", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPreviewWindow();

    const before = await projectPage.previewWindowBox();

    // Up and to the left: the window opens near the bottom-right corner, so
    // this direction stays inside the viewport and clear of the clamp.
    await projectPage.dragPreviewWindowBy(-120, -80);

    const after = await projectPage.previewWindowBox();

    expect(Math.round(after.x)).toBeLessThan(Math.round(before.x));
    expect(Math.round(after.y)).toBeLessThan(Math.round(before.y));
    // Dragging must not resize it.
    expect(Math.round(after.width)).toBe(Math.round(before.width));
  });

  test("resizes from the corner grip, keeping 16:9", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPreviewWindow();

    // Move it away from the edges first, so the resize isn't capped by the
    // viewport before it has grown.
    await projectPage.dragPreviewWindowBy(-260, -220);

    const before = await projectPage.previewWindowBox();
    await projectPage.resizePreviewWindowBy(120);
    const after = await projectPage.previewWindowBox();

    expect(after.width).toBeGreaterThan(before.width);

    // Height is derived from width, so the body keeps its aspect ratio. The
    // header is fixed height and excluded from the ratio.
    const frame = await projectPage.previewFrame.boundingBox();
    if (!frame) throw new Error("Preview frame has no bounding box");
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 1);
  });

  test("shrinking is bounded by a minimum width", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPreviewWindow();

    // Far more than the window's width, to push past the clamp.
    await projectPage.resizePreviewWindowBy(-1000);

    const box = await projectPage.previewWindowBox();
    expect(box.width).toBeGreaterThanOrEqual(199);
  });

  test("does not show the renderer's own fullscreen button inside", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPreviewWindow();

    // Prove the renderer really booted in there, so the absence below is
    // evidence of suppression rather than of an iframe that never loaded.
    await expect(
      projectPage.previewFrameContent.getByText("Waiting for input..."),
    ).toBeVisible();

    // An attribute selector rather than getByRole: the button carries
    // aria-hidden while idle, and role locators skip those, so a role query
    // would report zero even where the button does exist.
    await expect(
      projectPage.previewFrameContent.locator(
        'button[aria-label="Go fullscreen"]',
      ),
    ).toHaveCount(0);

    // The inverse, so the assertion above can't pass vacuously: the same
    // renderer without preview=1 does render the button.
    const rendererPage = await context.newPage();
    try {
      await rendererPage.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}`);
      await expect(
        rendererPage.getByText("Waiting for input..."),
      ).toBeVisible();
      await expect(
        rendererPage.locator('button[aria-label="Go fullscreen"]'),
      ).toHaveCount(1);
    } finally {
      await rendererPage.close();
    }
  });
});
