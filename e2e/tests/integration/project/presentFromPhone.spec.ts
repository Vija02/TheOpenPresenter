import { expect, test } from "../../../fixtures/screenFixture";
import { ProjectPage } from "../../../pages/ProjectPage";

const WORKER_TAG = `w${process.env.TEST_WORKER_INDEX ?? "0"}`;
const ORG_SLUG = `testorg-phone-${WORKER_TAG}`;
const ORG_NAME = `TestOrg Phone ${WORKER_TAG}`;
const USERNAME = `testuser_phone_${WORKER_TAG}`;
const PROJECT_NAME = "Phone Present Project";
const PROJECT_SLUG = "phone-present-project";

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

test.describe("Present from phone", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("offers a QR pointing at the remote for this project", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPresentFromPhone();

    // The QR encodes the remote, not the renderer: the phone becomes the
    // controller while this machine becomes the screen.
    const qrUrl = await projectPage.phoneQrUrl.textContent();
    expect(qrUrl).toContain(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    expect(qrUrl).not.toContain("/render/");
  });

  test("presenting on this screen mounts and dismisses the overlay", async ({
    page,
    context,
    e2eCommand,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await login(e2eCommand);

    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);
    await projectPage.openPresentFromPhone();

    await projectPage.presentOnThisScreenButton.click();

    await expect(projectPage.presentOverlayFrame).toBeVisible();
    await expect(projectPage.presentOverlayFrame).toHaveAttribute(
      "src",
      new RegExp(`/render/${ORG_SLUG}/${PROJECT_SLUG}`),
    );

    await projectPage.stopPresentingOverlayButton.click();
    await expect(projectPage.presentOverlayFrame).toBeHidden();
  });
});
