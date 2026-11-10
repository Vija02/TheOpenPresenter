import { expect, test } from "../../../fixtures/aiFixture";

/**
 * What the AI chat panels show when AI can't run for the organization, and the
 * status route that decides it. Which state applies is the server's call and
 * is unit tested there; here the route is answered directly so each state's
 * screen can be checked.
 */

// Each test logs in to a fresh copy of this worker's org.
test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

test.describe("AI when it can't run", () => {
  test("the chat says why in place of the message box", async ({
    page,
    loginAndGoToProject,
    projectPage,
  }) => {
    await page.route("**/ai/status?*", (route) =>
      route.fulfill({
        json: { state: "reconnect", actionUrl: "/o/somewhere/cloud" },
      }),
    );

    await loginAndGoToProject();
    await projectPage.createPlugin("Bible");
    await page.getByRole("button", { name: "Style" }).click();
    const dialog = page.getByRole("dialog", { name: "Slide Template" });
    await expect(dialog.locator(".lay--editor-surface")).toBeVisible();

    const notice = dialog.getByTestId("ai-unavailable");
    await expect(notice).toContainText("Your cloud sign-in has expired.");
    await expect(
      dialog.getByRole("button", { name: "Send", exact: true }),
    ).toHaveCount(0);

    const popup = page.waitForEvent("popup");
    await notice.getByRole("button", { name: "Reconnect" }).click();
    expect((await popup).url()).toContain("/o/somewhere/cloud");
  });
});

test.describe("AI status route", () => {
  test("needs a signed-in user", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL });
    const res = await anonymous.get("/ai/status");
    expect(res.status()).toBe(401);
    await anonymous.dispose();
  });

  test("is available on a server with its own key", async ({
    page,
    loginAndGoToProject,
    requireFakeAi,
  }) => {
    await requireFakeAi("layout");
    await loginAndGoToProject();

    // The page's own session, as the app would ask.
    const res = await page.request.get("/ai/status");
    expect(res.ok()).toBe(true);
    expect(await res.json()).toEqual({ state: "available" });
  });
});
