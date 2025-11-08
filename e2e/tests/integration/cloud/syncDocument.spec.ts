import { expect, test } from "../../../fixtures/cloudFixture";
import { LyricsPlugin } from "../../../pages/LyricsPlugin";
import { ProjectPage } from "../../../pages/ProjectPage";

test.describe("Cloud Document Sync", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("sync document content properly", async ({
    context,
    page,
    cloudPage,
    loginWithCloudProjects,
  }) => {
    await loginWithCloudProjects("/o/testorg/cloud");

    // Set up cloud connection
    await cloudPage.hostInput.clear();
    await cloudPage.hostInput.fill("http://localhost:5678");

    const popupPromise = page.waitForEvent("popup");
    await cloudPage.connectToCloudButton.click();

    const popup = await popupPromise;
    await popup.getByRole("heading", { name: "Login successful" });
    await popup.close();

    await cloudPage.selectOrgButton("testsyncorg").click();

    // 1. Should sync over basic document
    const originalProjectPage = await context.newPage();
    await originalProjectPage.goto("/o/testsyncorg");
    await originalProjectPage.getByText("SyncProject2").click();

    // Create lyrics plugin and add specific content
    const originalProjectPageObj = new ProjectPage(originalProjectPage);
    const originalLyricsPlugin = new LyricsPlugin(originalProjectPage);

    await originalProjectPageObj.createPlugin("Lyrics Presenter");
    await originalLyricsPlugin.addSong("Shout to the Lord");

    await expect(
      originalProjectPage.getByText(
        "Shout to the Lord all the earth let us sing",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    // Wait for it to be saved
    await page.waitForTimeout(2000);

    // Now sync the project
    await cloudPage.startSyncButton.click();
    // TODO: Better way to wait until sync is done
    await page.waitForTimeout(2000);

    // Open a new page to access the cloud org directly
    const newPage = await context.newPage();
    await newPage.goto("/o/testorg");

    // Find and open the synced project
    await expect(newPage.getByText("SyncProject2")).toBeVisible();
    await newPage.getByText("SyncProject2").click();

    await expect(
      newPage.getByText("Shout to the Lord", { exact: true }),
    ).toBeVisible();
  });
});
