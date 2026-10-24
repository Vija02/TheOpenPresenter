import {
  VIEWER_ORG,
  expect,
  test,
} from "../../../fixtures/hostProjectsFixture";
import { orgUrl } from "../../../helpers/workerData";

test.describe("Host Projects - Proxy", () => {
  test.beforeEach(async ({ e2eCommand, clearAllActiveDevices }) => {
    await Promise.all([
      e2eCommand.clearWorkerData(),
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
    await page.goto(orgUrl(VIEWER_ORG));
    await page.waitForLoadState("networkidle");
    await hostProjectsPage.clickHostProject("HostProject1");
    await page.waitForLoadState("networkidle");

    // Verify
    await expect(page.getByTitle("Timer", { exact: true })).toBeVisible();
  });
});
