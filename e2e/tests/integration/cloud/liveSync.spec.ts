import type { Page } from "@playwright/test";

import { SYNC_ORG_SLUG, expect, test } from "../../../fixtures/cloudFixture";
import { orgUrl } from "../../../helpers/workerData";
import { CloudPage } from "../../../pages/CloudPage";
import { OrganizationPage } from "../../../pages/OrganizationPage";

/**
 * Live sync: once connected, changes on either side reach the other within
 * seconds, with no "Start Sync" pressed after the first.
 *
 * `testorg` is the studio and `testsyncorg`, on the same server, its cloud.
 * Each sync is queued about 2s after a change, so allow a generous margin.
 *
 * Only projects that came from the cloud can be edited here: sharing one
 * database, a project created here cannot be pushed, since the cloud copy
 * would take its id. Bridging such a project once its push lands is covered
 * by `backend/server/__tests__/cloudBridgeRefresh.test.ts` instead.
 */

const LIVE_TIMEOUT = 20_000;

const connectAndSyncOnce = async (page: Page, cloudPage: CloudPage) => {
  await cloudPage.hostInput.clear();
  await cloudPage.hostInput.fill("http://localhost:5678");

  const popupPromise = page.waitForEvent("popup");
  await cloudPage.connectToCloudButton.click();
  const popup = await popupPromise;
  await popup.getByRole("heading", { name: "Login successful" });
  await popup.close();

  await cloudPage.selectOrgButton(SYNC_ORG_SLUG).click();
  // Pairs the two orgs' projects; everything after this is live.
  await cloudPage.startSyncButton.click();
};

/** Reload until `text` shows: the project list does not refresh itself. */
const expectAfterReload = async (page: Page, text: string) => {
  await expect(async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: LIVE_TIMEOUT });
};

const renameProject = async (
  organizationPage: OrganizationPage,
  from: string,
  to: string,
) => {
  await organizationPage.projectCards
    .filter({ hasText: from })
    .getByRole("button", { name: "Edit project" })
    .click();
  await organizationPage.projectEditModalNameInput.clear();
  await organizationPage.projectEditModalNameInput.fill(to);
  await organizationPage.projectEditModalSaveButton.click();
  await expect(organizationPage.projectCards.getByText(to)).toBeVisible();
};

test.describe("Cloud Live Sync", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("project edits reach the other side without pressing sync", async ({
    context,
    page,
    cloudPage,
    loginWithCloudProjects,
  }) => {
    test.slow();
    await loginWithCloudProjects(`${orgUrl()}/cloud`);
    await connectAndSyncOnce(page, cloudPage);

    const local = new OrganizationPage(await context.newPage());
    await local.page.goto(orgUrl());
    await expectAfterReload(local.page, "SyncProject2");

    const remote = new OrganizationPage(await context.newPage());
    await remote.page.goto(orgUrl(SYNC_ORG_SLUG));

    // Cloud to studio.
    await renameProject(remote, "SyncProject2", "Renamed on the cloud");
    await expectAfterReload(local.page, "Renamed on the cloud");

    // Studio to cloud.
    await renameProject(local, "SyncProject", "Renamed in the studio");
    await expectAfterReload(remote.page, "Renamed in the studio");
  });
});
