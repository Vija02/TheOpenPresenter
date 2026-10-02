import { expect, test } from "../../../fixtures/cloudFixture";
import { LyricsPlugin } from "../../../pages/LyricsPlugin";
import { ProjectPage } from "../../../pages/ProjectPage";

/**
 * The bridge direction: an edit made to the local copy reaches the remote
 * without a sync run.
 *
 * `syncDocument.spec.ts` covers the worker pulling remote state down. This
 * covers the opposite, which is the half that used to silently discard work:
 * the local server joins the remote document as a Yjs client while a project
 * is open, so a local edit travels up on its own.
 */
test.describe("Cloud Document Bridge", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("a local edit reaches the cloud without a sync run", async ({
    context,
    page,
    cloudPage,
    loginWithCloudProjects,
  }) => {
    await loginWithCloudProjects("/o/testorg/cloud");

    await cloudPage.hostInput.clear();
    await cloudPage.hostInput.fill("http://localhost:5678");

    const popupPromise = page.waitForEvent("popup");
    await cloudPage.connectToCloudButton.click();
    const popup = await popupPromise;
    await popup.getByRole("heading", { name: "Login successful" });
    await popup.close();

    await cloudPage.selectOrgButton("testsyncorg").click();

    // `testorg` is the local org; it pulls from `testsyncorg` on the far side.
    // One sync run first, so SyncProject2 exists locally and is paired with a
    // cloud_project_id. Without that pairing there is nothing to bridge.
    await cloudPage.startSyncButton.click();
    await page.waitForTimeout(3000);

    // Open the LOCAL copy and edit it. The bridge should carry this upward.
    const localProject = await context.newPage();
    await localProject.goto("/o/testorg");
    await expect(localProject.getByText("SyncProject2")).toBeVisible({
      timeout: 20_000,
    });
    await localProject.getByText("SyncProject2").click();

    const localProjectObj = new ProjectPage(localProject, context);
    const localLyrics = new LyricsPlugin(localProject);

    await localProjectObj.createPlugin("Lyrics Presenter");
    await localLyrics.addSong("Amazing Grace");

    // Not `exact`: the songbook resolves this to "Amazing Grace (My Chains
    // Are Gone)", and pinning the exact title couples the test to the fixture.
    await expect(localProject.getByText("Amazing Grace").first()).toBeVisible();

    // Deliberately no second `startSyncButton` click: if this only passes with
    // one, the bridge is not doing anything and the worker is.
    const remoteProject = await context.newPage();
    await remoteProject.goto("/o/testsyncorg");
    await remoteProject.getByText("SyncProject2").click();

    await expect(remoteProject.getByText("Amazing Grace").first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
