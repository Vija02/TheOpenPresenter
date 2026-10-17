import type { WebSocketRoute } from "@playwright/test";

import { expect, test } from "../../../fixtures/projectFixture";
import { ProjectPage } from "../../../pages/ProjectPage";

// After the computer sleeps, the network drops and comes back. The page must
// keep the connection it has, which reconnects by itself, rather than open a
// second one whose failure would replace the page with an error.

test.describe("Remote - network coming back", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("keeps its document connection", async ({
    page,
    loginAndGoToProject,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "chromium only");

    const connections: string[] = [];
    page.on("websocket", (ws) => {
      if (ws.url().includes("/wlink")) connections.push(ws.url());
    });

    await loginAndGoToProject();
    await expect(page.locator(".rt--app")).toBeVisible({ timeout: 30000 });
    expect(connections).toHaveLength(1);

    // The network blinks, as when waking from a short sleep
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await page.context().setOffline(false);
    await page.waitForTimeout(3000);

    expect(connections).toHaveLength(1);
    await expect(page.locator(".rt--app")).toBeVisible();
    await expect(page.getByText("Unable to connect")).toHaveCount(0);
  });

  test("recovers when the connection only comes back a while after waking", async ({
    page,
    loginAndGoToProject,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "chromium only");
    test.setTimeout(120000);

    // Every document connection goes through here, so it can be cut
    let reachable = true;
    let live: WebSocketRoute | null = null;
    let refused = 0;
    await page.routeWebSocket(/\/wlink/, (ws) => {
      if (!reachable) {
        refused++;
        ws.close();
        return;
      }
      ws.connectToServer();
      live = ws;
    });

    await loginAndGoToProject();
    await expect(page.locator(".rt--app")).toBeVisible({ timeout: 30000 });

    // Asleep: no network, and the connection the page had is gone
    reachable = false;
    await page.context().setOffline(true);
    await live!.close();
    live = null;
    // Longer than the 60s a fresh connection is allowed before it gives up
    await page.waitForTimeout(65000);
    expect(refused).toBeGreaterThan(0);

    // The network comes back
    reachable = true;
    await page.context().setOffline(false);
    // Straight away, not at the next of its retries, which are up to 30s apart
    await expect.poll(() => live, { timeout: 5000 }).not.toBeNull();

    await expect(page.getByText("Unable to connect")).toHaveCount(0);
    await expect(page.locator(".rt--app")).toBeVisible();

    // Syncing again: a scene added elsewhere shows up here
    const other = await page.context().newPage();
    await other.goto(page.url());
    await new ProjectPage(other, page.context()).createPlugin("Timer");
    await expect(page.getByText("Timer").first()).toBeVisible({
      timeout: 15000,
    });
  });
});
