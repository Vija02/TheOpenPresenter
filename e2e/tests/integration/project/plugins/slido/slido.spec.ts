import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import type { ProjectPage } from "../../../../../pages/ProjectPage";

type SetupArgs = {
  page: Page;
  loginAndGoToProject: () => Promise<void> | void;
  projectPage: ProjectPage;
};

/**
 * Slido is a third party site, so the iframes are never allowed to actually
 * load during tests. Every request to sli.do is answered with a stub page,
 * which keeps the specs offline and fast while still proving we point the
 * iframe at the right URL.
 */
const stubSlido = async (page: Page) => {
  await page.route("**://*.sli.do/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub slido</body></html>",
    }),
  );
};

const setupSlido = async ({
  page,
  loginAndGoToProject,
  projectPage,
}: SetupArgs) => {
  await stubSlido(page);
  await loginAndGoToProject();
  await projectPage.createPlugin("Slido");
  await expect(page.getByPlaceholder("Paste your Slido link")).toBeVisible();
};

test.describe.serial("Slido Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("starts with no event loaded and no preview", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupSlido({ page, projectPage, loginAndGoToProject });

    await expect(page.getByText("Show your Slido on screen")).toBeVisible();
    await expect(page.getByTitle("Slido preview")).toHaveCount(0);
  });

  test("accepts a join code and previews the results wall", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupSlido({ page, projectPage, loginAndGoToProject });

    await page.getByPlaceholder("Paste your Slido link").fill("#1234567");
    await page.getByRole("button", { name: "Load" }).click();

    const preview = page.getByTitle("Slido preview");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute(
      "src",
      "https://wall.sli.do/event/1234567",
    );
    // The link out must go to the host view, since that is where polls are
    // actually driven from. Linking to the wall would be a dead end.
    await expect(
      page.getByRole("link", { name: "Open in Slido" }),
    ).toHaveAttribute("href", "https://admin.sli.do/event/1234567");
    await expect(
      page.getByRole("link", { name: "Slido itself" }),
    ).toHaveAttribute("href", "https://admin.sli.do/event/1234567");
    await expect(
      page.getByText("This screen only mirrors Slido"),
    ).toBeVisible();
    await expect(page.getByText("Show your Slido on screen")).toBeHidden();
  });

  test("a host link previews the wall, not the host UI", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupSlido({ page, projectPage, loginAndGoToProject });

    await page
      .getByPlaceholder("Paste your Slido link")
      .fill("https://admin.sli.do/event/abc123XYZ/polls");
    await page.getByRole("button", { name: "Load" }).click();

    await expect(page.getByTitle("Slido preview")).toHaveAttribute(
      "src",
      "https://wall.sli.do/event/abc123XYZ",
    );
  });

  test("rejects input that is not a Slido link or code", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupSlido({ page, projectPage, loginAndGoToProject });

    await page.getByPlaceholder("Paste your Slido link").fill("not a code");
    await page.getByRole("button", { name: "Load" }).click();

    await expect(
      page.getByText("That doesn't look like a Slido link or event code"),
    ).toBeVisible();
    await expect(page.getByTitle("Slido preview")).toHaveCount(0);
  });

  test("changing the event removes the preview", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupSlido({ page, projectPage, loginAndGoToProject });

    await page.getByPlaceholder("Paste your Slido link").fill("#1234567");
    await page.getByRole("button", { name: "Load" }).click();
    await expect(page.getByTitle("Slido preview")).toBeVisible();

    await page.getByTestId("slido-clear").click();

    // The event is only removed once the PopConfirm is accepted.
    await expect(page.getByTitle("Slido preview")).toBeVisible();
    await page.getByTestId("popconfirm-confirm").click();

    await expect(page.getByTitle("Slido preview")).toHaveCount(0);
    await expect(page.getByText("Show your Slido on screen")).toBeVisible();
  });

  test("the preview cannot be clicked into", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    // The stub renders a button that records its own clicks, so a click that
    // reaches the Slido document is observable. The overlay must stop it.
    await page.route("**://*.sli.do/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<html><body style="margin:0">
          <button id="target" style="width:100vw;height:100vh"
            onclick="window.__clicked = true">slido</button>
        </body></html>`,
      }),
    );
    await loginAndGoToProject();
    await projectPage.createPlugin("Slido");

    await page.getByPlaceholder("Paste your Slido link").fill("#1234567");
    await page.getByRole("button", { name: "Load" }).click();

    const preview = page.getByTitle("Slido preview");
    await expect(preview).toBeVisible();

    const box = (await preview.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const frame = page.frameLocator("iframe[title='Slido preview']");
    await expect(frame.locator("#target")).toBeVisible();
    const clicked = await page
      .frames()
      .find((f) => f.url().includes("sli.do"))!
      .evaluate(() => (window as any).__clicked ?? false);
    expect(clicked).toBe(false);
  });

  test("renders the results wall on the output screen", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupSlido({ page, projectPage, loginAndGoToProject });

    await page.getByPlaceholder("Paste your Slido link").fill("#1234567");
    await page.getByRole("button", { name: "Load" }).click();
    await page.getByRole("button", { name: "Go live" }).click();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();

    const rendererPage = await projectPage.present();
    await stubSlido(rendererPage);
    await rendererPage.waitForLoadState("networkidle");

    await expect(rendererPage.locator("iframe[src*='sli.do']")).toHaveAttribute(
      "src",
      "https://wall.sli.do/event/1234567",
    );
  });
});
