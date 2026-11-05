import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/canvaFixture";

/**
 * Canva, end to end against the fake Canva (e2e/scripts/fakeCanvaServer.ts):
 * connected accounts, "Import once", and visitors on a public upload link.
 * Sign-in, token storage, one-time grants, design listing and the export are
 * all real; only Canva is a stand-in.
 */

const WELCOME = "Welcome Slides";

/** The Canva card, on the landing page or in the add-slides picker. */
const canvaCard = (page: Page) => page.getByTestId("slides-integration-canva");

/** Once slides exist, the integrations live behind the "Add slide" tile. */
const openAddSlides = async (page: Page) => {
  await page.getByText("Add slide", { exact: true }).click();
  await expect(canvaCard(page)).toBeVisible();
};

/** Opened by clicking Canva: connected accounts, then connect or import once. */
const chooserOf = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: "Import once" });

/** The design list, after choosing an account or signing in once. */
const designPickerOf = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: "Switch account" });

/** Clicks through a sign-in popup, which closes itself once signed in. */
const signInThroughPopup = async (page: Page, open: () => Promise<void>) => {
  const popupPromise = page.waitForEvent("popup");
  await open();
  const popup = await popupPromise;
  // It can be done and closed before we get to it, and "close" won't fire again
  if (!popup.isClosed()) {
    await popup.waitForEvent("close", { timeout: 30_000 });
  }
};

/** The design's two PDF pages, once the import has finished. */
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

/** Connects the signed-in Canva account; the chooser then lists it. */
const connectAccount = async (page: Page, label: string) => {
  await canvaCard(page).click();
  await signInThroughPopup(page, () =>
    chooserOf(page)
      .getByRole("button", { name: /^Connect (a|another) Canva account/ })
      .click(),
  );
  await expect(chooserOf(page).getByText(label)).toBeVisible();
};

/** From an open chooser: pick the account, then the design. */
const importWithAccount = async (page: Page, label: string) => {
  await chooserOf(page).getByText(label).click();
  await designPickerOf(page).getByText(WELCOME).click();
  await expectImported(page);
};

/** Creates a public upload link from the landing screen; returns its URL. */
const createUploadLink = async (page: Page) => {
  await page.getByTestId("slides-collect-from-others").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("slides-create-upload-link").click();
  const urlInput = dialog.getByTestId("slides-upload-link-url").first();
  await expect(urlInput).toBeVisible();
  const url = await urlInput.inputValue();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return url;
};

/** A visitor on the upload link sends a Canva design, signing in on the way. */
const visitorSendsDesign = async (visitor: BrowserContext, url: string) => {
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(url);

  await signInThroughPopup(visitorPage, () =>
    visitorPage.getByTestId("slides-upload-source-canva").click(),
  );
  await visitorPage
    .getByRole("dialog")
    .getByRole("button", { name: WELCOME })
    .click();
  await expect(visitorPage.getByText("Your slides has been sent.")).toBeVisible(
    { timeout: 60_000 },
  );
  return visitorPage;
};

test.describe("Slides Plugin - Canva", () => {
  test.beforeEach(async ({ e2eCommand, requireFakeCanva }) => {
    await e2eCommand.clearWorkerData();
    await requireFakeCanva();
  });

  test("connects an account and imports a design from it", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeCanva,
  }) => {
    const account = fakeCanva.newAccountId();
    await fakeCanva.signInAs(account, { displayName: "Worship Team" });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAccount(page, "Worship Team");
    await importWithAccount(page, "Worship Team");

    expect(await fakeCanva.exportCount(account)).toBe(1);

    // Stored: after a reload, the account is still there to pick from
    await page.reload();
    await openAddSlides(page);
    await canvaCard(page).click();
    await expect(chooserOf(page).getByText("Worship Team")).toBeVisible();
  });

  test("import once brings a design in without connecting the account", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeCanva,
  }) => {
    const account = fakeCanva.newAccountId();
    await fakeCanva.signInAs(account, { displayName: "Just Once" });

    await openSlides({ projectPage, loginAndGoToProject });
    await canvaCard(page).click();
    await signInThroughPopup(page, () =>
      chooserOf(page)
        .getByRole("button", { name: /^Import once/ })
        .click(),
    );

    // Straight to the designs, with no account in between
    const picker = designPickerOf(page);
    await expect(
      picker.getByText("Signed in for this import only"),
    ).toBeVisible();
    await picker.getByText(WELCOME).click();
    await expectImported(page);
    expect(await fakeCanva.exportCount(account)).toBe(1);

    // Nothing was kept
    await page.reload();
    await openAddSlides(page);
    await canvaCard(page).click();
    const chooser = chooserOf(page);
    await expect(chooser.getByText("Import from Canva")).toBeVisible();
    await expect(chooser.getByText("Just Once")).toHaveCount(0);
  });

  test("imports a design from a pasted share link", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeCanva,
  }) => {
    const account = fakeCanva.newAccountId();
    await fakeCanva.signInAs(account, { displayName: "Worship Team" });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAccount(page, "Worship Team");
    await chooserOf(page).getByText("Worship Team").click();

    const picker = designPickerOf(page);
    const linkInput = picker.getByTestId("slides-public-link-input");

    // Not a Canva link: caught before anything is sent
    await linkInput.fill("https://example.com/design/abc");
    await picker.getByTestId("slides-public-link-submit").click();
    await expect(picker.getByRole("alert")).toContainText(
      "isn't a Canva design link",
    );

    // A design this account can't open
    await linkInput.fill(
      "https://www.canva.com/design/design-someone-else/abc123/view",
    );
    await picker.getByTestId("slides-public-link-submit").click();
    await expect(picker.getByRole("alert")).toContainText(
      "can't open that design",
    );
    expect(await fakeCanva.exportCount(account)).toBe(0);

    // One it can
    await linkInput.fill(
      "https://www.canva.com/design/design-notices/xyz789/edit?utm_source=sharebutton",
    );
    await picker.getByTestId("slides-public-link-submit").click();
    await expect(picker).toBeHidden();
    await expectImported(page);
    expect(await fakeCanva.exportCount(account)).toBe(1);
  });

  test("the chooser's share link needs a connected account", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeCanva,
  }) => {
    const account = fakeCanva.newAccountId();
    await fakeCanva.signInAs(account, { displayName: "Worship Team" });

    await openSlides({ projectPage, loginAndGoToProject });
    await canvaCard(page).click();

    // No account yet: shown, but disabled, and says why on hover
    const option = chooserOf(page).getByTestId("slides-public-link-option");
    await expect(option).toHaveAttribute("aria-disabled", "true");
    await option.hover();
    await expect(page.getByRole("tooltip")).toContainText(
      "Connect a Canva account first",
    );
    await option.click({ force: true });
    await expect(
      chooserOf(page).getByTestId("slides-public-link-input"),
    ).toHaveCount(0);

    // Once connected, a link imports straight from the chooser
    await signInThroughPopup(page, () =>
      chooserOf(page)
        .getByRole("button", { name: /^Connect (a|another) Canva account/ })
        .click(),
    );
    const chooser = chooserOf(page);
    await expect(chooser.getByText("Worship Team")).toBeVisible();
    await chooser.getByTestId("slides-public-link-option").click();
    await chooser
      .getByTestId("slides-public-link-input")
      .fill("https://www.canva.com/design/design-notices/xyz789/view");
    await chooser.getByTestId("slides-public-link-submit").click();

    await expect(chooser).toBeHidden();
    await expectImported(page);
    expect(await fakeCanva.exportCount(account)).toBe(1);
  });

  test("disconnecting removes the account", async ({
    page,
    projectPage,
    loginAndGoToProject,
    fakeCanva,
  }) => {
    const account = fakeCanva.newAccountId();
    await fakeCanva.signInAs(account, { displayName: "Worship Team" });

    await openSlides({ projectPage, loginAndGoToProject });
    await connectAccount(page, "Worship Team");

    const chooser = chooserOf(page);
    await chooser.getByRole("button", { name: "Disconnect" }).click();
    // The confirm popover's own button
    await page
      .getByRole("button", { name: "Disconnect", exact: true })
      .last()
      .click();

    await expect(chooser.getByText("Worship Team")).toBeHidden();
    await expect(chooser.getByText("Import from Canva")).toBeVisible();
  });

  test("a visitor's Canva sign-in imports without joining the org's accounts", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
    fakeCanva,
  }) => {
    test.setTimeout(120_000);
    const visitorAccount = fakeCanva.newAccountId("visitor");

    await openSlides({ projectPage, loginAndGoToProject });
    const url = await createUploadLink(page);

    const visitor = await browser.newContext();
    try {
      await fakeCanva.signInAs(
        visitorAccount,
        { displayName: "Visiting Designer" },
        visitor,
      );
      await visitorSendsDesign(visitor, url);
    } finally {
      await visitor.close();
    }
    expect(await fakeCanva.exportCount(visitorAccount)).toBe(1);

    // The design landed in the scene
    await page.reload();
    await expectImported(page);

    // But the visitor's Canva account is nowhere in the org's list
    await openAddSlides(page);
    await canvaCard(page).click();
    const chooser = chooserOf(page);
    await expect(chooser.getByText("Import from Canva")).toBeVisible();
    await expect(chooser.getByText("Visiting Designer")).toHaveCount(0);
  });

  test("a visitor signing in with the org's own Canva account leaves it connected", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
    fakeCanva,
  }) => {
    test.setTimeout(120_000);
    // The same Canva account on both sides. This used to hand the org's
    // connection over to the visitor, and the next visitor then deleted it.
    const shared = fakeCanva.newAccountId("shared");
    await fakeCanva.signInAs(shared, { displayName: "Shared Account" });

    await openSlides({ projectPage, loginAndGoToProject });
    const url = await createUploadLink(page);
    await connectAccount(page, "Shared Account");
    await page.keyboard.press("Escape");

    const visitor = await browser.newContext();
    try {
      await fakeCanva.signInAs(
        shared,
        { displayName: "Shared Account" },
        visitor,
      );
      await visitorSendsDesign(visitor, url);
      // A second visitor sign-in used to delete what the first had taken over
      await visitorSendsDesign(visitor, url);
    } finally {
      await visitor.close();
    }

    // The member's connection is untouched and still works
    await page.reload();
    await openAddSlides(page);
    await canvaCard(page).click();
    await expect(chooserOf(page).getByText(/^Added by /)).toBeVisible();
    await chooserOf(page).getByText("Shared Account").click();
    await expect(designPickerOf(page).getByText(WELCOME)).toBeVisible();
  });
});
