import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/projectFixture";
import type { ProjectPage } from "../../../../../pages/ProjectPage";

type SetupArgs = {
  page: Page;
  loginAndGoToProject: () => Promise<void> | void;
  projectPage: ProjectPage;
};

/**
 * Replace `getDisplayMedia` with a fake canvas stream so the share flow runs
 * without the OS screen-picker (which Playwright can't drive). Must be
 * registered before the app document loads, hence `addInitScript`.
 */
const stubDisplayMedia = async (page: Page) => {
  await page.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    (navigator.mediaDevices as any).getDisplayMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      let hue = 0;
      // Keep repainting so the captured track actually produces frames.
      window.setInterval(() => {
        if (!ctx) return;
        hue = (hue + 20) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }, 100);
      // captureStream is available on HTMLCanvasElement in browsers.
      return (canvas as any).captureStream(10) as MediaStream;
    };
  });
};

/**
 * Stubs the screen picker, logs in, and creates a Screen Share scene through
 * the add-scene menu (so creation is covered too). Leaves the operator on the
 * scene's idle state.
 */
const setupScreenShare = async ({
  page,
  loginAndGoToProject,
  projectPage,
}: SetupArgs) => {
  await stubDisplayMedia(page);
  await loginAndGoToProject();
  await projectPage.createPlugin("Screen Share");
  await expect(page.getByText("Share your screen live")).toBeVisible();
};

test.describe.serial("Screen Share Plugin", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("can create the scene and shows the idle empty state", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupScreenShare({ page, projectPage, loginAndGoToProject });

    await expect(page.getByText("Choose what to share")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share screen" }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("No output screens connected yet"),
    ).toBeVisible();
  });

  test("can start and stop sharing", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupScreenShare({ page, projectPage, loginAndGoToProject });

    await page.getByRole("button", { name: "Share screen" }).first().click();

    // Now in the sharer view.
    await expect(page.getByText("Your shared screen")).toBeVisible();
    const stopButton = page.getByRole("button", { name: "Stop sharing" });
    await expect(stopButton).toBeVisible();

    await stopButton.click();

    // Back to the idle state.
    await expect(page.getByText("Share your screen live")).toBeVisible();
    await expect(page.getByText("Your shared screen")).toBeHidden();
  });

  test("shows the LIVE indicator once the scene is set live", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    await setupScreenShare({ page, projectPage, loginAndGoToProject });

    await page.getByRole("button", { name: "Share screen" }).first().click();
    await expect(page.getByText("Your shared screen")).toBeVisible();

    // Not live yet: no LIVE badge, a Go live button is offered.
    await expect(page.getByText("LIVE", { exact: true })).toBeHidden();

    await page.getByRole("button", { name: "Go live" }).first().click();

    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Go live" })).toHaveCount(0);
  });

  test("streams the shared screen to a renderer", async ({
    page,
    projectPage,
    loginAndGoToProject,
  }) => {
    test.setTimeout(60_000);

    await setupScreenShare({ page, projectPage, loginAndGoToProject });

    await page.getByRole("button", { name: "Share screen" }).first().click();
    await expect(page.getByText("Your shared screen")).toBeVisible();

    // Make the scene live so the renderer displays it.
    await page.getByRole("button", { name: "Go live" }).first().click();
    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();

    const rendererPage = await projectPage.present();
    await rendererPage.waitForLoadState("networkidle");

    // The renderer connects as a WebRTC viewer and plays the stream. Wait for
    // real frames (videoWidth > 0) rather than just the element existing.
    await rendererPage.waitForFunction(
      () => {
        const v = document.querySelector("video");
        return !!v && v.readyState >= 2 && v.videoWidth > 0;
      },
      undefined,
      { timeout: 45_000 },
    );
  });
});
