import { expect, test } from "../../../../../fixtures/planningCenterFixture";

/**
 * Planning Center integration, end to end against the fake PCO
 * (e2e/scripts/fakePcoServer.ts). Everything on the app's side is real: the
 * OAuth round trip, the token exchange, the pco_connection row, the Services
 * API calls and the chord chart parser.
 *
 * These specs never touch MyWorshipList, so an organization here starts with
 * no sources at all and the empty state is what greets it.
 *
 * Serial, like the other plugin specs: they all log in as the same `testorg`,
 * and the beforeEach sweep would pull that org out from under a sibling test
 * running at the same time.
 */
test.describe.serial("Lyrics Presenter - Planning Center", () => {
  test.beforeEach(async ({ e2eCommand, requireFakePco }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
    await requireFakePco();
  });

  test("connects an account and lists its service plans", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    await fakePco.scenario({ organizationName: "Grace Community" });

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    // No source is on yet, so the empty state offers both.
    const scope = await lyricsPlugin.openAddSurface();
    const connectButton = scope.getByTestId("ly-connect-pco");
    await expect(connectButton).toBeVisible();

    await lyricsPlugin.connectPlanningCenter(connectButton);

    // The plans arrive from the fake, keyed by their service date.
    await expect(
      scope.getByTestId("ly-setlist-card").filter({ hasText: "January 4" }),
    ).toBeVisible();
    await expect(scope.getByTestId("ly-setlist-card")).toHaveCount(2);
  });

  test("imports a plan's songs with the chord chart parsed into sections", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    await fakePco.scenario();

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    const scope = await lyricsPlugin.openAddSurface();
    await lyricsPlugin.connectPlanningCenter(
      scope.getByTestId("ly-connect-pco"),
    );

    await scope
      .getByTestId("ly-setlist-card")
      .filter({ hasText: "January 4" })
      .click();

    // The import view lists both songs from the plan.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Amazing Grace")).toBeVisible();
    await expect(dialog.getByText("How Great Thou Art")).toBeVisible();

    await dialog.getByRole("button", { name: "Import", exact: true }).click();

    // Both songs landed in the scene.
    await expect(page.getByTestId("ly-edit-song")).toHaveCount(2);

    // The chord chart was parsed: the chord row above the lyric is gone, and
    // the bare "VERSE 1" heading became a section. Reading this from the
    // rendered slides rather than the API is the point — it is the parser's
    // output the user actually sees.
    await expect(
      page.getByText("Amazing grace how sweet the sound").first(),
    ).toBeVisible();
    await expect(page.getByText("D          G      D")).toHaveCount(0);
  });

  test("a connected account persists across a reload", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    await fakePco.scenario({ organizationName: "Persisted Church" });

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    const scope = await lyricsPlugin.openAddSurface();
    await lyricsPlugin.connectPlanningCenter(
      scope.getByTestId("ly-connect-pco"),
    );
    await expect(scope.getByTestId("ly-setlist-card").first()).toBeVisible();

    await page.reload();

    // The connection is a DB row, not client state, so it survives.
    const dialog = await lyricsPlugin.openSetlistSourcesModal();
    await expect(lyricsPlugin.pcoConnectionRow).toContainText(
      "Persisted Church",
    );
    await expect(dialog.getByText("Connected by")).toBeVisible();
  });

  test("shows the connected account, then disconnects it", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    await fakePco.scenario({
      organizationName: "Disconnect Church",
      personName: "Someone Else",
    });

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    const scope = await lyricsPlugin.openAddSurface();
    await lyricsPlugin.connectPlanningCenter(
      scope.getByTestId("ly-connect-pco"),
    );
    await expect(scope.getByTestId("ly-setlist-card").first()).toBeVisible();

    const dialog = await lyricsPlugin.openSetlistSourcesModal();
    await expect(lyricsPlugin.pcoConnectionRow).toContainText(
      "Disconnect Church",
    );

    // Only one account is supported, so there is no "Connect" button while one
    // is connected.
    await expect(dialog.getByTestId("ly-pco-connect")).toHaveCount(0);

    await lyricsPlugin.disconnectPlanningCenter();

    // Gone, and connecting is on offer again.
    await expect(lyricsPlugin.pcoConnectionRow).toHaveCount(0);
    await expect(dialog.getByTestId("ly-pco-connect")).toBeVisible();
  });

  test("a person without Services access is told why, and no account is connected", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    // PCO answers 403 to every Services read for this person, which the plugin
    // hits while reading the identity during the callback.
    await fakePco.scenario({ noServicesAccess: true });

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    const scope = await lyricsPlugin.openAddSurface();
    await lyricsPlugin.connectPlanningCenter(
      scope.getByTestId("ly-connect-pco"),
    );

    await expect(
      scope.getByText(/cannot open the Services product/i),
    ).toBeVisible();

    // Nothing was saved, so the empty state is still offering to connect.
    await expect(scope.getByTestId("ly-connect-pco")).toBeVisible();
    await expect(scope.getByTestId("ly-setlist-card")).toHaveCount(0);
  });

  test("declining the authorization leaves the plugin unconnected", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    await fakePco.scenario({ denyAuthorization: true });

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    const scope = await lyricsPlugin.openAddSurface();
    await lyricsPlugin.connectPlanningCenter(
      scope.getByTestId("ly-connect-pco"),
    );

    await expect(scope.getByText(/said no|access_denied/i)).toBeVisible();
    await expect(scope.getByTestId("ly-connect-pco")).toBeVisible();
  });

  test("an account with no plans says so rather than showing an empty strip", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    await fakePco.scenario({ plans: [] });

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    const scope = await lyricsPlugin.openAddSurface();
    await lyricsPlugin.connectPlanningCenter(
      scope.getByTestId("ly-connect-pco"),
    );

    await expect(
      scope.getByText(
        "No service plans found in this Planning Center account.",
      ),
    ).toBeVisible();
  });

  test("Planning Center comes before MyWorshipList when both are on", async ({
    page,
    projectPage,
    lyricsPlugin,
    loginAndGoToProject,
    fakePco,
  }) => {
    await fakePco.scenario();

    await loginAndGoToProject();
    await projectPage.createPlugin("Lyrics Presenter");

    const scope = await lyricsPlugin.openAddSurface();
    await lyricsPlugin.connectPlanningCenter(
      scope.getByTestId("ly-connect-pco"),
    );
    await expect(scope.getByTestId("ly-setlist-card").first()).toBeVisible();

    // Turn MyWorshipList on too, so both tabs are rendered.
    const dialog = await lyricsPlugin.openSetlistSourcesModal();
    await dialog.getByTestId("ly-mwl-toggle").click();
    await expect(dialog.getByTestId("ly-mwl-toggle")).toHaveText("Turn off");
    await lyricsPlugin.closeDialog();

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.first()).toHaveText("Planning Center");

    // First is also the one selected, without the user picking anything.
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  });
});
