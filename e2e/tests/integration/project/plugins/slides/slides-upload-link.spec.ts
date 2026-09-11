import type { Page } from "@playwright/test";
import { join } from "node:path";

import { expect, test } from "../../../../../fixtures/projectFixture";

/**
 * Public upload links for the Slides plugin.
 *
 * A member generates an unguessable link from a slides scene, and anyone
 * holding that URL can send slides into that specific scene without an
 * account. The interesting parts are all on the anonymous side, so most of
 * these assertions run in a fresh browser context with no session.
 *
 * A link owns ONE slide: uploading again replaces it and spends an attempt,
 * so the cap is on attempts rather than on slides kept.
 */

const PDF = join(__dirname, "../../../../../dummyFiles/dummySlide.pdf");
const PDF2 = join(__dirname, "../../../../../dummyFiles/dummySlide2.pdf");
const IMAGE = join(__dirname, "../../../../../dummyFiles/dummyImage.jpg");

/** Opens the collect-links dialog from the slides landing screen. */
const openCollectDialog = async (page: Page) => {
  await page.getByTestId("slides-collect-from-others").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
};

/**
 * Creates a link and returns its public URL.
 *
 * Read off the rendered input rather than rebuilt from the token, so the test
 * exercises the same URL a member would actually copy.
 */
const createLink = async (
  page: Page,
  { label, maxAttempts }: { label?: string; maxAttempts?: number } = {},
) => {
  const dialog = await openCollectDialog(page);

  if (label) {
    await dialog.getByPlaceholder("e.g. Sunday guest speaker").fill(label);
  }

  if (maxAttempts !== undefined) {
    // The attempt cap lives behind the Advanced accordion.
    await dialog.getByRole("button", { name: "Advanced" }).click();
    await dialog.getByLabel("Upload attempts").fill(String(maxAttempts));
  }

  await dialog.getByTestId("slides-create-upload-link").click();

  const urlInput = dialog.getByTestId("slides-upload-link-url").first();
  await expect(urlInput).toBeVisible();

  const url = await urlInput.inputValue();
  expect(url).toContain("/plugin/slides/upload/");

  return { dialog, url };
};

/**
 * Sends a file through the public page.
 *
 * The visible drop area is a click target for a hidden input, so the file goes
 * straight to the input and the upload starts on change. There is no submit
 * button to press.
 */
const sendFile = async (visitorPage: Page, file: string) => {
  const toast = visitorPage.getByText("Your slides has been sent.");

  // Success toasts share one toastId, so a leftover toast from a previous
  // send would satisfy the wait below instantly. Clear it first, otherwise
  // this helper cannot tell "sent" from "sent a moment ago".
  await toast.waitFor({ state: "detached" }).catch(() => {});

  await visitorPage.locator("#uploader-file").setInputFiles(file);
  await expect(toast).toBeVisible({ timeout: 60 * 1000 });
};

test.describe("Slides Plugin - public upload links", () => {
  test.beforeEach(
    async ({ e2eCommand }) =>
      await Promise.all([
        e2eCommand.serverCommand("clearTestUsers"),
        e2eCommand.serverCommand("clearTestOrganizations"),
      ]),
  );

  test("a visitor with the link can send a slide into the scene", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    const { url } = await createLink(page, { label: "Sunday speaker" });

    // Everything below happens with no session at all.
    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      await visitorPage.goto(url);

      // The page is a real React surface using @repo/ui, not a bare form.
      await expect(
        visitorPage.getByRole("heading", { name: "Send your slides" }),
      ).toBeVisible();
      await expect(visitorPage.getByText("Sunday speaker")).toBeVisible();

      await visitorPage
        .getByLabel("Your name (optional)")
        .fill("Visiting Speaker");
      await sendFile(visitorPage, PDF);
    } finally {
      await visitor.close();
    }

    // Back on the member's side, the slide has landed in this scene.
    await page.reload();
    await expect(page.getByTestId("slide-container").first()).toBeVisible({
      timeout: 30 * 1000,
    });
  });

  test("uploading again replaces the slide instead of adding a second", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    // Two real imports back to back, so the default 30s cap is not enough.
    test.setTimeout(120 * 1000);

    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    const { url } = await createLink(page);

    // dummySlide2.pdf is 3 pages; a pure append would leave first + 3.
    const PDF2_PAGES = 3;
    let firstUploadSlides = 0;

    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      await visitorPage.goto(url);

      const send = async (file: string) => await sendFile(visitorPage, file);

      await send(PDF);

      // The visitor sees what they sent, and that it can be replaced.
      await expect(
        visitorPage.getByText("Upload again to replace your slides."),
      ).toBeVisible({ timeout: 30 * 1000 });

      // Count what the first upload produced, so the assertion after the
      // replacement doesn't depend on how many pages the fixture has.
      await page.reload();
      await expect(page.getByTestId("slide-container").first()).toBeVisible({
        timeout: 30 * 1000,
      });
      firstUploadSlides = await page.getByTestId("slide-container").count();

      await send(PDF2);
    } finally {
      await visitor.close();
    }

    // One link owns one slide: the replacement takes the first one's place
    // rather than being appended alongside it.
    await page.reload();
    const slides = page.getByTestId("slide-container");
    await expect(slides.first()).toBeVisible({ timeout: 30 * 1000 });

    const after = await slides.count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(firstUploadSlides + PDF2_PAGES);
  });

  test("a revoked link stops working", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    const { dialog, url } = await createLink(page);

    // Confirm it works before turning it off, so the assertion after the
    // revoke can only be explained by the revoke.
    const before = await browser.newContext();
    try {
      const beforePage = await before.newPage();
      const res = await beforePage.goto(url);
      expect(res?.status()).toBe(200);
    } finally {
      await before.close();
    }

    // The revoke control is an icon-only button; PopConfirm then asks to
    // confirm with a labelled "Turn off".
    await dialog.getByTestId("slides-revoke-upload-link").first().click();
    await page.getByRole("button", { name: "Turn off" }).click();

    const after = await browser.newContext();
    try {
      const afterPage = await after.newPage();
      const res = await afterPage.goto(url);
      expect(res?.status()).toBe(403);
    } finally {
      await after.close();
    }
  });

  test("an unknown token is rejected", async ({ browser }) => {
    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      const res = await visitorPage.goto(
        "/plugin/slides/upload/definitelynotarealtoken",
      );
      expect(res?.status()).toBe(404);
    } finally {
      await visitor.close();
    }
  });

  /**
   * Running out of attempts is different from a revoked or expired link: the
   * page still renders so the visitor can see what they already sent, with
   * every way of sending another one turned off.
   */
  test("spending the last attempt disables the page without a reload", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    test.setTimeout(120 * 1000);

    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    const { url } = await createLink(page, { maxAttempts: 1 });

    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      await visitorPage.goto(url);

      const dropzone = visitorPage.getByTestId("slides-upload-dropzone");
      const alert = visitorPage.getByTestId("slides-upload-spent");
      const google = visitorPage.getByTestId(
        "slides-upload-source-googleslides",
      );

      // Nothing is disabled yet. Without this the assertions below could pass
      // against a page that was never enabled in the first place.
      await expect(alert).toBeHidden();
      await expect(dropzone).not.toHaveAttribute("aria-disabled", "true");

      await sendFile(visitorPage, PDF);

      // The cap is now spent. This page was never reloaded, so anything it
      // shows has to have come from the status poll after the upload.
      await expect(alert).toBeVisible({ timeout: 30 * 1000 });
      await expect(
        visitorPage.getByText(
          "You've used all your attempts on this link. Ask whoever sent it for a new one.",
        ),
      ).toBeVisible();

      await expect(dropzone).toHaveAttribute("aria-disabled", "true");
      await expect(
        visitorPage.getByLabel("Your name (optional)"),
      ).toBeDisabled();

      // The integration cards are the other way in, so they go too.
      if (await google.count()) {
        await expect(google).toHaveAttribute("aria-disabled", "true");
      }

      // The visitor can still see what they sent, and is no longer told they
      // can replace it.
      await expect(visitorPage.getByText("dummySlide.pdf")).toBeVisible();
      await expect(
        visitorPage.getByText("Upload again to replace your slides."),
      ).toBeHidden();
    } finally {
      await visitor.close();
    }
  });

  test("a spent link is refused by the server, not just hidden in the UI", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    test.setTimeout(120 * 1000);

    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    const { url } = await createLink(page, { maxAttempts: 1 });

    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      await visitorPage.goto(url);
      await sendFile(visitorPage, PDF);

      // Bypass the disabled UI entirely and POST the way the page would. The
      // cap has to hold even when the browser is not cooperating.
      const status = await visitorPage.evaluate(async (target) => {
        const body = new FormData();
        body.append(
          "file",
          new File(["not a real pdf"], "second.pdf", {
            type: "application/pdf",
          }),
        );
        const res = await fetch(target, {
          method: "POST",
          headers: { "x-top-csrf-protection": "1" },
          body,
        });
        return res.status;
      }, url);

      expect(status).toBe(403);

      // A spent link still SERVES its page, unlike a revoked one.
      const res = await visitorPage.goto(url);
      expect(res?.status()).toBe(200);
      await expect(
        visitorPage.getByTestId("slides-upload-spent"),
      ).toBeVisible();
    } finally {
      await visitor.close();
    }
  });

  test("images are accepted as well as PDFs", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    const { url } = await createLink(page);

    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      await visitorPage.goto(url);

      await sendFile(visitorPage, IMAGE);
    } finally {
      await visitor.close();
    }

    await page.reload();
    await expect(page.getByTestId("slide-container").first()).toBeVisible({
      timeout: 30 * 1000,
    });
  });

  test("the dialog can also be opened from Settings", async ({
    page,
    browser,
    projectPage,
    loginAndGoToProject,
  }) => {
    await loginAndGoToProject();
    await projectPage.createPlugin("Slides");

    // Settings lives on the toolbar, which only appears once the scene has
    // slides, so send one through the link first.
    const { url } = await createLink(page, { label: "From settings" });
    await page.keyboard.press("Escape");

    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      await visitorPage.goto(url);
      await sendFile(visitorPage, IMAGE);
    } finally {
      await visitor.close();
    }

    await page.reload();
    await expect(page.getByTestId("slide-container").first()).toBeVisible({
      timeout: 30 * 1000,
    });

    await page.getByRole("button", { name: "Settings" }).click();
    const settings = page.getByRole("dialog");
    await expect(settings.getByText("Slides Settings")).toBeVisible();

    await settings.getByRole("button", { name: "Manage links" }).click();

    // Settings closes and the collect dialog takes its place, showing the
    // link made earlier.
    await expect(
      page.getByRole("dialog").getByText("Collect slides from others"),
    ).toBeVisible();
    await expect(
      page.getByTestId("slides-upload-link-url").first(),
    ).toBeVisible();
  });
});
