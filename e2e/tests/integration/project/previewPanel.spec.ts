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

test.describe("Preview panel", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("is open by default and shows a muted renderer preview", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    await expect(projectPage.previewPanel).toBeVisible();

    // preview=1 is what makes the renderer start silent and drop its own
    // fullscreen button, so it's the flag worth asserting on.
    await expect(projectPage.previewFrame).toHaveAttribute(
      "src",
      new RegExp(`/render/${ORG_SLUG}/${PROJECT_SLUG}.*preview=1`),
    );

    // The preview's own renderer must not pass for a real screen
    await expect(
      projectPage.previewFrameContent.getByText("Waiting for input..."),
    ).toBeVisible();
    await expect(page.getByTitle("Active screens")).toHaveText("0");
  });

  test("collapses from its sidebar section and remembers it", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await expect(projectPage.previewFrame).toBeVisible();

    // On desktop, the section header is the toggle
    await projectPage.previewToggleButton.click();
    await expect(projectPage.previewToggleButton).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // Nothing left running in the background either
    await expect(projectPage.previewFrame).toHaveCount(0);

    await page.reload();
    await expect(projectPage.previewToggleButton).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(projectPage.previewFrame).toHaveCount(0);

    await projectPage.previewToggleButton.click();
    await expect(projectPage.previewFrame).toBeVisible();
  });

  test("starts muted and toggles", async ({ page, context, e2eCommand }) => {
    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await expect(projectPage.previewPanel).toBeVisible();

    // Header actions only show while the section is hovered
    await projectPage.previewPanel.hover();

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

  test("sits at the bottom of the sidebar, under Present, and follows the sidebar's width", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    const before = await projectPage.previewPanelBox();
    expect(Math.round(before.x)).toBeLessThan(10);
    // Present sits under the scene list's Add, above the preview
    const add = await page.getByTestId("add-scene").boundingBox();
    const present = await page
      .locator(".rt--sidebar-web-container")
      .getByRole("button", { name: "Present", exact: true })
      .boundingBox();
    if (!add || !present) throw new Error("Add or Present has no bounding box");
    expect(present.y).toBeGreaterThanOrEqual(add.y + add.height - 1);
    expect(present.y + present.height).toBeLessThanOrEqual(before.y);

    await projectPage.resizeSidebarBy(200);
    // Back over the preview: the iframe must not swallow the drag
    await projectPage.resizeSidebarBy(-100);

    const after = await projectPage.previewPanelBox();
    expect(Math.round(after.width)).toBe(Math.round(before.width) + 100);

    const frame = await projectPage.previewFrame.boundingBox();
    if (!frame) throw new Error("Preview frame has no bounding box");
    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 1);
  });

  test("isn't shown on phones, along with the top bar's Present", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    // Only the sidebar's remains. Waited on first, so the checks below run
    // once the page is up rather than passing before it loads
    await expect(
      page.getByRole("button", { name: "Present", exact: true }),
    ).toHaveCount(1);
    await expect(projectPage.previewFrame).toHaveCount(0);
    await expect(projectPage.previewToggleButton).toHaveCount(0);
  });

  test("does not show the renderer's own fullscreen button inside", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

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
