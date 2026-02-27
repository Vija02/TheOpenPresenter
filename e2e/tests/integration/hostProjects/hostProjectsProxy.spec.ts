import { expect, test } from "../../../fixtures/hostProjectsFixture";

test.describe("Host Projects - Proxy", () => {
  test.beforeEach(async ({ e2eCommand, clearAllActiveDevices }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
      e2eCommand.serverCommand("stopMockHostDevice"),
      clearAllActiveDevices(),
    ]);
  });

  test.afterEach(async ({ stopMockHostDevice, clearAllActiveDevices }) => {
    await stopMockHostDevice();
    await clearAllActiveDevices();
  });

  test("can view host project through proxy", async ({
    page,
    hostProjectsPage,
    setupHostProjectsEnvironment,
  }) => {
    test.slow();

    await setupHostProjectsEnvironment();

    // Navigate to viewer dashboard and click on host project
    await page.goto("/o/testviewerorg");
    await page.waitForLoadState("networkidle");
    await hostProjectsPage.clickHostProject("HostProject1");
    await page.waitForLoadState("networkidle");

    // Verify
    await expect(page.getByTitle("Timer")).toBeVisible();
  });
});
