import { expect, test } from "../../../fixtures/hostProjectsFixture";

test.describe("Host Projects - Dashboard", () => {
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

  test("host projects appear and disappear based on device status", async ({
    page,
    hostProjectsPage,
    setupHostProjectsEnvironment,
    stopMockHostDevice,
  }) => {
    test.slow();

    const { hostPage } = await setupHostProjectsEnvironment();

    await page.goto("/o/testviewerorg");
    await page.waitForLoadState("networkidle");

    await expect(hostProjectsPage.hostProjectsHeading).toBeVisible();
    await expect(
      hostProjectsPage.getHostProjectCardByName("HostProject1"),
    ).toBeVisible();

    // Cleanup device
    await hostPage.close();
    await stopMockHostDevice();

    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: "networkidle" });

    await expect(hostProjectsPage.hostProjectsHeading).not.toBeVisible();
  });
});
