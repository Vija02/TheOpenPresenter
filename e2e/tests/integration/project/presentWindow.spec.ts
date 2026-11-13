import { expect, test } from "../../../fixtures/screenFixture";
import { addOutput, openManageOutputs } from "../../../helpers/outputs";
import { WORKER_TAG } from "../../../helpers/workerData";
import { ProjectPage } from "../../../pages/ProjectPage";
import { RendererScreenPage } from "../../../pages/Renderer/RendererScreenPage";

const ORG_SLUG = `testorg-pwin-${WORKER_TAG}`;
const ORG_NAME = `TestOrg PWin ${WORKER_TAG}`;
const USERNAME = `testuser_pwin_${WORKER_TAG}`;
const PROJECT_NAME = "Present Window Project";
const PROJECT_SLUG = "present-window-project";

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

test.describe("Present in a new window", () => {
  test.beforeEach(async ({ e2eCommand }) => {
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: ORG_SLUG,
    });
    await e2eCommand.serverCommand("clearUserByUsername", {
      username: USERNAME,
    });
  });

  test("opens a window, makes it fullscreen and stops it", async ({
    page,
    context,
    e2eCommand,
    browserName,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    await projectPage.openPresentMenu();
    const popupPromise = page.waitForEvent("popup");
    await projectPage.openInNewTabLink.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(
      new RegExp(`/render/${ORG_SLUG}/${PROJECT_SLUG}\\?renderer=1`),
    );

    // Firefox can't hand the click over
    if (browserName === "chromium") {
      await projectPage.makeFullscreenButton.click();
      await expect
        .poll(() => popup.evaluate(() => !!document.fullscreenElement))
        .toBe(true);
      await expect(page.getByText("Main is fullscreen")).toBeVisible();
    } else {
      await expect(page.getByText(/bottom-right corner/)).toBeVisible();
      await expect(projectPage.makeFullscreenButton).toHaveCount(0);
    }

    await page.getByRole("button", { name: "Back to Present" }).click();
    await expect(
      page.getByRole("radiogroup", { name: "What to show" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(projectPage.stopAllPresentingButton.first()).toBeVisible();

    const closed = popup.waitForEvent("close");
    await projectPage.stopAllPresentingButton.first().click();
    await page.getByTestId("popconfirm-confirm").click();
    await closed;
    await expect(projectPage.stopAllPresentingButton).toHaveCount(0);
  });

  test("presents a different output", async ({ page, context, e2eCommand }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    await openManageOutputs(page);
    await addOutput(page, "Confidence monitor");
    await page.keyboard.press("Escape");

    await projectPage.openPresentMenu();
    await expect(projectPage.openInNewTabLink).toHaveAttribute(
      "href",
      /renderer=1(&|$)/,
    );

    await page
      .getByRole("radio", { name: /Confidence monitor/ })
      .first()
      .click();
    await expect(projectPage.openInNewTabLink).toHaveAttribute(
      "href",
      /renderer=(?!1(&|$))[^&]+/,
    );
  });

  test("shows the same output in more than one window", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    const openWindow = async () => {
      await projectPage.openPresentMenu();
      const popupPromise = page.waitForEvent("popup");
      await projectPage.openInNewTabLink.click();
      const popup = await popupPromise;
      await page.keyboard.press("Escape");
      return popup;
    };
    const first = await openWindow();
    const second = await openWindow();

    expect(first.isClosed()).toBe(false);
    await projectPage.openPresentMenu();
    const tree = page.getByTestId("present-destinations-1");
    await expect(tree.getByText(/ window$/)).toHaveCount(2);

    await page.keyboard.press("Escape");
    const closed = Promise.all([
      first.waitForEvent("close"),
      second.waitForEvent("close"),
    ]);
    await projectPage.stopAllPresentingButton.first().click();
    await page.getByTestId("popconfirm-confirm").click();
    await closed;
  });

  test("lists where each output is showing, and closes them", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    await projectPage.openPresentMenu();
    const popupPromise = page.waitForEvent("popup");
    await projectPage.openInNewTabLink.click();
    const popup = await popupPromise;
    await page.keyboard.press("Escape");

    // Navigated, so it can't close itself
    const tab = await context.newPage();
    await tab.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=1&first`);
    await tab.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=1`);

    await projectPage.openPresentMenu();
    const tree = page.getByTestId("present-destinations-1");
    await expect(tree.getByRole("listitem")).toHaveCount(2);
    await expect(tree.getByText(/ window$/)).toBeVisible();
    await expect(tree.getByText(/ tab$/)).toBeVisible();
    await expect(
      tree.getByRole("button", { name: "Close it from the browser" }),
    ).toBeDisabled();

    const closed = popup.waitForEvent("close");
    await tree.getByRole("button", { name: /^Close the .* window$/ }).click();
    await closed;
    await expect(tree.getByRole("listitem")).toHaveCount(1);
  });

  test("lists and closes a screen on another device", async ({
    page,
    context,
    browser,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    // Another computer
    const otherDevice = await browser.newContext({
      storageState: await context.storageState(),
    });
    const opener = await otherDevice.newPage();
    await opener.goto(`/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=2`);
    const tabPromise = opener.waitForEvent("popup");
    await opener.evaluate(
      (url) => window.open(url, "_blank"),
      `/render/${ORG_SLUG}/${PROJECT_SLUG}?renderer=1`,
    );
    const tab = await tabPromise;

    await projectPage.openPresentMenu();
    const tree = page.getByTestId("present-destinations-1");
    await expect(tree.getByRole("listitem")).toHaveCount(1);
    await expect(tree.getByText(/ tab$/)).toBeVisible();

    const closed = tab.waitForEvent("close");
    await tree.getByRole("button", { name: /^Close the .* tab$/ }).click();
    await closed;
    await expect(tree).toHaveCount(0);
    await otherDevice.close();
  });

  test("shows the devices showing a virtual screen under it", async ({
    page,
    context,
    browser,
    e2eCommand,
    setupScreen,
  }) => {
    await login(e2eCommand);
    const screen = await setupScreen({
      orgSlug: ORG_SLUG,
      slug: `testscreen-pwin-${WORKER_TAG}`,
      name: "Lobby TV",
    });
    const projectPage = new ProjectPage(page, context);
    await page.goto(`/app/${ORG_SLUG}/${PROJECT_SLUG}`);

    const tv = await browser.newContext({
      storageState: await context.storageState(),
    });
    const tvPage = await tv.newPage();
    await new RendererScreenPage(tvPage).goto(ORG_SLUG, screen.screenSlug);

    await projectPage.openPresentMenu();
    await page.getByRole("button", { name: /^Lobby TV/ }).click();

    const tree = page.getByTestId("present-destinations-1");
    const lobby = tree.getByRole("listitem").filter({ hasText: "Lobby TV" });
    await expect(lobby).toBeVisible();
    await expect(lobby.getByRole("listitem")).toHaveCount(1);
    await expect(lobby.getByRole("listitem")).toHaveText(/Windows|Linux|Mac/);

    await tv.close();
    await expect(lobby).toContainText("Not open on any device");
  });
});
