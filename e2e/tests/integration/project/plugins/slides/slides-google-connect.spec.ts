import type { Page } from "@playwright/test";

import {
  DrivePicker,
  expect,
  test,
} from "../../../../../fixtures/googleSlidesFixture";

/**
 * Connecting Google accounts and importing from them, end to end against the
 * fake Google (e2e/scripts/fakeGoogleServer.ts). The sign-in, token storage,
 * refresh, revocation and import are all real; only Google, its Drive Picker
 * widget and its in-browser sign-in ("import once") are stand-ins.
 */

const DECK = { id: "deck-sunday", name: "Sunday Service" };

/** The Google Slides card, on the landing page or in the add-slides picker. */
const googleCard = (page: Page) =>
  page.getByTestId("slides-integration-googleslides");

/** Once slides exist, the integrations live behind the "Add slide" tile. */
const openAddSlides = async (page: Page) => {
  await page.getByText("Add slide", { exact: true }).click();
  await expect(googleCard(page)).toBeVisible();
};

/** Opened by clicking Google: connected accounts, then connect or import once. */
const accountChooserOf = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: "Import once" });

const connectOption = (page: Page) =>
  accountChooserOf(page).getByRole("button", {
    name: /^Connect (a|another) Google account/,
  });

/** No account is stored: the chooser only offers to connect or import once. */
const expectNoAccounts = async (page: Page) => {
  await googleCard(page).click();
  const chooser = accountChooserOf(page);
  await expect(chooser.getByText("Import from Google")).toBeVisible();
  await expect(chooser.getByRole("button", { name: "Disconnect" })).toHaveCount(
    0,
  );
  await chooser.getByRole("button", { name: "Cancel" }).click();
};

/** Clicks through a sign-in popup, which closes itself once connected. */
const signInThroughPopup = async (page: Page, open: () => Promise<void>) => {
  const popupPromise = page.waitForEvent("popup");
  await open();
  const popup = await popupPromise;
  // It can be done and closed before we get to it, and "close" won't fire again
  if (popup.isClosed()) return;
  await popup.waitForEvent("close", { timeout: 30_000 }).catch(async () => {
    // It only closes itself on success. On failure it stays up showing the
    // reason, which the app has already been told.
    await popup.close();
  });
};

/** The deck's two PDF pages, once the import has finished. */
const expectImported = async (page: Page) => {
  // Not a bare count: the "Add slide" tile is a slide container too.
  // Wait for the image, not the placeholder: the import is still running
  // until its pages are rendered.
  await expect(
    page
      .getByTestId("slide-container")
      .filter({ hasText: /^Slide 2$/ })
      .locator("img"),
  ).toBeVisible({ timeout: 30_000 });
};

const openSlides = async ({
  projectPage,
  loginAndGoToProject,
}: {
  projectPage: { createPlugin: (name: "Slides") => Promise<void> };
  loginAndGoToProject: () => Promise<void> | void;
}) => {
  await loginAndGoToProject();
  await projectPage.createPlugin("Slides");
};

/** First use: connect an account, then the picker opens with it. */
const connectAndImport = async (page: Page, drivePicker: DrivePicker) => {
  drivePicker.willPick(DECK);
  await googleCard(page).click();
  await signInThroughPopup(page, () => connectOption(page).click());
  await expectImported(page);
};

test.describe("Slides Plugin - Google Slides accounts", () => {
  test.beforeEach(async ({ e2eCommand, requireFakeGoogle }) => {
    await e2eCommand.clearWorkerData();
    await requireFakeGoogle();
  });

  test("connects an account and imports a deck with its stored token", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const account = fakeGoogle.newAccountId();
    await fakeGoogle.signInAs(account, { email: "worship@example.com" });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAndImport(page, drivePicker);

    // The picker was handed the server's token, so Google's own in-browser
    // sign-in never ran
    expect(drivePicker.openedWithTokens).toHaveLength(1);
    expect(drivePicker.openedWithTokens[0]).toMatch(/^access-/);
    expect(drivePicker.inBrowserSignIns()).toBe(0);

    // The deck itself came from Google with that account's token
    expect((await fakeGoogle.activity(account)).exportCount).toBe(1);
  });

  test("picks again from the account chooser without signing in", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const account = fakeGoogle.newAccountId();
    await fakeGoogle.signInAs(account, { email: "worship@example.com" });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAndImport(page, drivePicker);

    // A reload proves the connection is stored, not held in the page
    await page.reload();

    let popups = 0;
    page.on("popup", () => {
      popups += 1;
    });

    await openAddSlides(page);
    drivePicker.willPick({ id: "deck-evening", name: "Evening Service" });
    await googleCard(page).click();

    const chooser = accountChooserOf(page);
    await expect(chooser).toBeVisible();
    await chooser.getByRole("button", { name: /worship@example\.com/ }).click();

    await expect
      .poll(() => fakeGoogle.activity(account).then((a) => a.exportCount))
      .toBe(2);
    // Let the second deck finish importing, or its pages are still being
    // made when the next test clears the org
    await expect(
      page
        .getByTestId("slide-container")
        .filter({ hasText: /^Slide 4$/ })
        .locator("img"),
    ).toBeVisible({ timeout: 30_000 });
    expect(popups).toBe(0);
    expect(drivePicker.openedWithTokens).toHaveLength(2);
    expect(drivePicker.inBrowserSignIns()).toBe(0);
  });

  test("refreshes an expired token before using it", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const account = fakeGoogle.newAccountId();
    // Expired as soon as it is issued, so every use has to refresh first
    await fakeGoogle.signInAs(account, { expiresIn: 1 });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAndImport(page, drivePicker);

    expect((await fakeGoogle.activity(account)).refreshCount).toBeGreaterThan(
      0,
    );
  });

  test("connects a second account alongside the first", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const first = fakeGoogle.newAccountId("first");
    const second = fakeGoogle.newAccountId("second");
    await fakeGoogle.signInAs(first, { email: "first@example.com" });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAndImport(page, drivePicker);

    await fakeGoogle.signInAs(second, { email: "second@example.com" });
    drivePicker.willPick(null);

    await openAddSlides(page);
    await googleCard(page).click();
    const chooser = accountChooserOf(page);
    await signInThroughPopup(page, () => connectOption(page).click());

    // Straight into the new account's Drive
    await expect.poll(() => drivePicker.openedWithTokens.length).toBe(2);
    expect(drivePicker.openedWithTokens[1]).not.toBe(
      drivePicker.openedWithTokens[0],
    );

    // Cancelling the picker leaves the add-slides picker open
    await googleCard(page).click();
    await expect(chooser.getByText("first@example.com")).toBeVisible();
    await expect(chooser.getByText("second@example.com")).toBeVisible();
  });

  test("disconnecting removes the account and revokes it at Google", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const account = fakeGoogle.newAccountId();
    await fakeGoogle.signInAs(account, { email: "worship@example.com" });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAndImport(page, drivePicker);

    await openAddSlides(page);
    await googleCard(page).click();
    const chooser = accountChooserOf(page);
    await chooser.getByRole("button", { name: "Disconnect" }).click();
    // The confirm popover's own button
    await page
      .getByRole("button", { name: "Disconnect", exact: true })
      .last()
      .click();

    // The last account is gone; the chooser stays, offering the other ways in
    await expect(chooser.getByText("worship@example.com")).toBeHidden();
    await expect(chooser.getByText("Import from Google")).toBeVisible();
    await expect
      .poll(() => fakeGoogle.activity(account).then((a) => a.revokeCount))
      .toBe(1);
    await chooser.getByRole("button", { name: "Cancel" }).click();

    // Imported slides stay
    await expectImported(page);
  });

  test("a cancelled sign-in says so and connects nothing", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const account = fakeGoogle.newAccountId();
    await fakeGoogle.signInAs(account, { denyAuthorization: true });

    await openSlides({ projectPage, loginAndGoToProject });
    await googleCard(page).click();
    const popupPromise = page.waitForEvent("popup");
    await connectOption(page).click();
    const popup = await popupPromise;

    // The popup stays up showing the reason; the app says so too
    await expect(page.getByText("Google sign-in was cancelled.")).toBeVisible();
    await popup.close();
    expect(drivePicker.openedWithTokens).toHaveLength(0);

    // Still nothing connected
    await expectNoAccounts(page);
  });

  test("access removed at Google drops the account", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const account = fakeGoogle.newAccountId();
    // Short-lived, so the next use refreshes and finds the grant gone
    await fakeGoogle.signInAs(account, {
      email: "worship@example.com",
      expiresIn: 1,
    });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAndImport(page, drivePicker);

    await fakeGoogle.revokeAccess(account);

    await openAddSlides(page);
    await googleCard(page).click();
    await accountChooserOf(page)
      .getByRole("button", { name: /worship@example\.com/ })
      .click();

    // The picker never opens, and the user is told why
    await expect(
      page.getByText(
        "Access to this Google account was removed. Connect it again.",
      ),
    ).toBeVisible();
    expect(drivePicker.openedWithTokens).toHaveLength(1);

    // The dead connection was cleared. Reload so the check reads the server,
    // not the page's cached account list.
    await page.reload();
    await openAddSlides(page);
    await expectNoAccounts(page);
  });

  test("import once brings a deck in without connecting the account", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeGoogle,
    drivePicker,
  }) => {
    const account = fakeGoogle.newAccountId();
    drivePicker.signInInBrowserWith(await fakeGoogle.browserToken(account));
    drivePicker.willPick(DECK);

    await openSlides({ projectPage, loginAndGoToProject });

    let popups = 0;
    page.on("popup", () => {
      popups += 1;
    });

    await googleCard(page).click();
    await accountChooserOf(page)
      .getByRole("button", { name: /^Import once/ })
      .click();
    await expectImported(page);

    // Google's own sign-in ran in the page, and its token did the import
    expect(popups).toBe(0);
    expect(drivePicker.inBrowserSignIns()).toBe(1);
    expect(drivePicker.openedWithTokens).toHaveLength(1);
    expect(drivePicker.openedWithTokens[0]).toMatch(/^browser-/);
    expect((await fakeGoogle.activity(account)).exportCount).toBe(1);

    // And nothing was kept
    await page.reload();
    await openAddSlides(page);
    await expectNoAccounts(page);
  });
});
