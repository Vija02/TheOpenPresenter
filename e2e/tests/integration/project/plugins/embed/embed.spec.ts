import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import type { ProjectPage } from "../../../../../pages/ProjectPage";

type SetupArgs = {
  page: Page;
  loginAndGoToProject: () => Promise<void> | void;
  projectPage: ProjectPage;
};

/**
 * The embed plugin points at arbitrary third party sites, so every outbound
 * request is stubbed. The specs prove which URL we point at, not that the
 * remote site renders.
 */
const stubSite = async (page: Page) => {
  await page.route("**://example.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub page</body></html>",
    }),
  );
};

const setupEmbed = async ({
  page,
  loginAndGoToProject,
  projectPage,
}: SetupArgs) => {
  await stubSite(page);
  await loginAndGoToProject();
  await projectPage.createPlugin("Embed");
  await expect(page.getByPlaceholder("Paste a web address")).toBeVisible();
};

test.describe.serial("Embed Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("starts on the empty state with no preview", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupEmbed({ page, projectPage, loginAndGoToProject });

    await expect(page.getByText("Show a web page on screen")).toBeVisible();
    await expect(page.getByTitle("Embed preview")).toHaveCount(0);
  });

  test("loads a url and previews it", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupEmbed({ page, projectPage, loginAndGoToProject });

    await page
      .getByPlaceholder("Paste a web address")
      .fill("https://example.com/page");
    await page.getByRole("button", { name: "Load" }).click();

    await expect(page.getByTitle("Embed preview")).toHaveAttribute(
      "src",
      "https://example.com/page",
    );
    await expect(page.getByText("Show a web page on screen")).toBeHidden();
  });

  test("renders the page on the output screen", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupEmbed({ page, projectPage, loginAndGoToProject });

    await page
      .getByPlaceholder("Paste a web address")
      .fill("https://example.com/page");
    await page.getByRole("button", { name: "Load" }).click();
    await page.getByRole("button", { name: "Go live" }).click();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();

    const rendererPage = await projectPage.present();
    await stubSite(rendererPage);
    await rendererPage.waitForLoadState("networkidle");

    await expect(
      rendererPage.locator("iframe[src*='example.com']"),
    ).toHaveAttribute("src", "https://example.com/page");
  });
});
