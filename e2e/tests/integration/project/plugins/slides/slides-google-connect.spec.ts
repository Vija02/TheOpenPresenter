import type { Page } from "@playwright/test";

import {
  DrivePicker,
  expect,
  test,
} from "../../../../../fixtures/googleSlidesFixture";

/**
 * Connecting Google accounts and importing from them, end to end against the
 * fake Google (e2e/scripts/fakeGoogleServer.ts). The sign-in, token storage,
 * refresh, revocation and import are all real; only Google, and its Drive
 * Picker widget, are stand-ins.
 *
 * Serial, like the other plugin specs: they all log in as the same `testorg`,
 * and the beforeEach sweep would pull that org out from under a sibling test.
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

/** The account isn't stored any more: clicking Google signs in again. */
const expectSignInAgain = async (page: Page) => {
  const popupPromise = page.waitForEvent("popup");
  await googleCard(page).click();
  await (await popupPromise).close();
  await expect(accountChooserOf(page)).toBeHidden();
};

const accountChooserOf = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: "Choose a Google account" });

/** Clicks through a sign-in popup, which closes itself once connected. */
const signInThroughPopup = async (page: Page, open: () => Promise<void>) => {
  const popupPromise = page.waitForEvent("popup");
  await open();
  const popup = await popupPromise;
  await popup.waitForEvent("close", { timeout: 30_000 }).catch(async () => {
    // It only closes itself on success. On failure it stays up showing the
    // reason, which the app has already been told.
    await popup.close();
  });
};

/** The deck's two PDF pages, once the import has finished. */
const expectImported = async (page: Page) => {
  // Not a bare count: the "Add slide" tile is a slide container too
  await expect(
    page.getByTestId("slide-container").filter({ hasText: /^Slide 2$/ }),
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

/** First use: sign in, then the picker opens with the new account. */
const connectAndImport = async (page: Page, drivePicker: DrivePicker) => {
  drivePicker.willPick(DECK);
  await signInThroughPopup(page, () => googleCard(page).click());
  await expectImported(page);
};

test.describe.serial("Slides Plugin - Google Slides accounts", () => {
  test.beforeEach(async ({ e2eCommand, requireFakeGoogle }) => {
    await Promise.all([
      e2eCommand.serverCommand("clearTestUsers"),
      e2eCommand.serverCommand("clearTestOrganizations"),
    ]);
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

    expect((await fakeGoogle.activity(account)).refreshCount).toBeGreaterThan(0);
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
    await signInThroughPopup(page, () =>
      chooser
        .getByRole("button", { name: "Connect another Google account" })
        .click(),
    );

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
    await page.getByRole("button", { name: "Disconnect", exact: true }).last().click();

    // The last account is gone, so the chooser closes
    await expect(chooser).toBeHidden();
    await expect
      .poll(() => fakeGoogle.activity(account).then((a) => a.revokeCount))
      .toBe(1);

    // Imported slides stay
    await expectImported(page);

    // Nothing left to pick from, so the next click signs in again
    await expectSignInAgain(page);
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
    await signInThroughPopup(page, () => googleCard(page).click());

    await expect(page.getByText("Google sign-in was cancelled.")).toBeVisible();
    expect(drivePicker.openedWithTokens).toHaveLength(0);

    // Still nothing connected: the next click signs in again
    await expectSignInAgain(page);
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
    await expectSignInAgain(page);
  });
});
