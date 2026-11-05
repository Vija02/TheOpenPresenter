import type { Page } from "@playwright/test";

import { expect, test } from "../../../../../fixtures/googleSlidesFixture";

/**
 * Importing a Google Slides deck from its public share link, with no Google
 * account. The fake Google (e2e/scripts/fakeGoogleServer.ts) treats decks
 * whose id starts with `public-` as shared with "Anyone with the link".
 */

const PUBLIC_DECK = "public-deck-0123456789abcdef";
const PRIVATE_DECK = "private-deck-0123456789abcdef";

const deckLink = (id: string) =>
  `https://docs.google.com/presentation/d/${id}/edit?usp=sharing`;

const googleCard = (page: Page) =>
  page.getByTestId("slides-integration-googleslides");

const chooserOf = (page: Page) =>
  page.getByRole("dialog").filter({ hasText: "Paste a public link" });

/** Opens the chooser and its link field. */
const openLinkField = async (page: Page) => {
  await googleCard(page).click();
  const chooser = chooserOf(page);
  await chooser.getByTestId("slides-public-link-option").click();
  return chooser;
};

const submitLink = async (page: Page, link: string) => {
  const chooser = chooserOf(page);
  await chooser.getByTestId("slides-public-link-input").fill(link);
  await chooser.getByTestId("slides-public-link-submit").click();
};

/** The deck's two PDF pages, once the import has finished. */
const expectImported = async (page: Page) => {
  await expect(
    page
      .getByTestId("slide-container")
      .filter({ hasText: /^Slide 2$/ })
      .locator("img"),
  ).toBeVisible({ timeout: 30_000 });
};

test.describe("Slides Plugin - Google Slides public link", () => {
  test.beforeEach(
    async ({
      e2eCommand,
      requireFakeGoogle,
      loginAndGoToProject,
      projectPage,
    }) => {
      await e2eCommand.clearWorkerData();
      await requireFakeGoogle();
      await loginAndGoToProject();
      await projectPage.createPlugin("Slides");
    },
  );

  test("imports a publicly shared deck without signing in", async ({
    page,
  }) => {
    let popups = 0;
    page.on("popup", () => {
      popups += 1;
    });

    await openLinkField(page);
    await submitLink(page, deckLink(PUBLIC_DECK));

    await expect(chooserOf(page)).toBeHidden();
    await expectImported(page);
    expect(popups).toBe(0);
  });

  test("explains a link that isn't to a deck", async ({ page }) => {
    await openLinkField(page);
    await submitLink(page, "https://docs.google.com/document/d/abc/edit");

    // Caught before anything is sent, so the field stays up to fix
    await expect(chooserOf(page).getByRole("alert")).toContainText(
      "isn't a Google Slides link",
    );
  });

  test("explains a deck that isn't shared publicly", async ({ page }) => {
    await openLinkField(page);
    await submitLink(page, deckLink(PRIVATE_DECK));

    await expect(page.getByText(/isn't public/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/^Slide 1$/)).toHaveCount(0);
  });
});
