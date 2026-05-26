import { expect, test } from "../../../fixtures/baseFixture";

test.describe("Homepage /init-demo pairing", () => {
  test("QR URL spins up a demo project, embeds the renderer, and stays in sync with the phone", async ({
    page,
    browser,
  }) => {
    test.skip(!!process.env.PLAYWRIGHT_TAURI, "Skipped in Tauri E2E tests");

    await page.goto("/");

    const qrBlock = page.locator("#init-demo-qr-block");
    await expect(qrBlock).toBeVisible();

    const qrUrlEl = page.getByTestId("init-demo-qr-url");
    await expect(qrUrlEl).toHaveText(/\/init-demo\?id=/, { timeout: 15_000 });
    const qrUrl = (await qrUrlEl.textContent())?.trim();
    expect(qrUrl, "expected QR URL to be populated by SSE").toBeTruthy();

    // Sanity-check the URL shape
    const parsed = new URL(qrUrl!);
    expect(parsed.pathname).toBe("/init-demo");
    expect(parsed.searchParams.get("id")).toBeTruthy();

    // Simulate the phone scanning the QR code in a separate browser context
    const phoneContext = await browser.newContext();
    try {
      const phonePage = await phoneContext.newPage();
      // /init-demo redirects to /app/demo/<slug>; we only care that the
      // server-side provisioning + Redis publish runs, so wait for the
      // redirect to land.
      await phonePage.goto(qrUrl!);
      await expect(phonePage).toHaveURL(/\/app\/demo\/demo-/, {
        timeout: 20_000,
      });

      // Back on the homepage, the SSE listener should swap in the renderer.
      const rendererSection = page.locator("#init-demo-renderer-section");
      await expect(rendererSection).toBeVisible({ timeout: 20_000 });

      const rendererIframe = page.locator("#init-demo-renderer-iframe");
      await expect(rendererIframe).toHaveAttribute(
        "src",
        /^\/render\/demo\/demo-/,
      );

      // QR block hides, sign-up CTA + feature list reveal.
      await expect(qrBlock).toBeHidden();
      await expect(page.locator("#init-demo-cta-block")).toBeVisible();
      await expect(page.locator("#init-demo-features")).toBeVisible();

      // Wait for the renderer iframe to actually mount.
      const rendererFrame = page.frameLocator("#init-demo-renderer-iframe");
      await expect(rendererFrame.locator("body")).toBeVisible({
        timeout: 30_000,
      });

      // --- Slide control: click on the phone, observe the renderer change ---
      const phoneSlides = phonePage
        .getByTestId("slide-container")
        .filter({ hasNotText: "Add slide" });
      await expect(phoneSlides).toHaveCount(5, { timeout: 20_000 });
      await expect(phoneSlides.nth(0)).toHaveAttribute("aria-current", "true");

      // Click the third slide on the phone. We use index 2 (0-based).
      const TARGET_SLIDE_INDEX = 2; // == /images/demo/3.jpg
      await phoneSlides.nth(TARGET_SLIDE_INDEX).click();

      // The phone's own UI should reflect the click first
      await expect(phoneSlides.nth(TARGET_SLIDE_INDEX)).toHaveAttribute(
        "aria-current",
        "true",
      );
      await expect(phoneSlides.nth(0)).not.toHaveAttribute(
        "aria-current",
        "true",
      );

      // Reach into the renderer iframe and figure out which demo slide is
      // visually active.
      const iframeHandle = await page
        .locator("#init-demo-renderer-iframe")
        .elementHandle();
      expect(iframeHandle, "renderer iframe element should exist").toBeTruthy();
      const rendererContentFrame = await iframeHandle!.contentFrame();
      expect(
        rendererContentFrame,
        "renderer iframe should have a content frame",
      ).toBeTruthy();

      const getActiveDemoSlide = async () => {
        return await rendererContentFrame!.evaluate(() => {
          const imgs = Array.from(
            document.querySelectorAll("img"),
          ) as HTMLImageElement[];
          for (const img of imgs) {
            const m = img.src.match(/\/images\/demo\/(\d+)\.jpg/);
            if (!m) continue;
            let el: HTMLElement | null = img;
            let visible = true;
            while (el) {
              if (getComputedStyle(el).opacity === "0") {
                visible = false;
                break;
              }
              el = el.parentElement;
            }
            if (visible) return Number(m[1]);
          }
          return null;
        });
      };

      await expect
        .poll(getActiveDemoSlide, { timeout: 15_000 })
        .toBe(TARGET_SLIDE_INDEX + 1);

      // And clicking back to slide 1 should likewise propagate.
      await phoneSlides.nth(0).click();
      await expect(phoneSlides.nth(0)).toHaveAttribute("aria-current", "true");
      await expect.poll(getActiveDemoSlide, { timeout: 15_000 }).toBe(1);
    } finally {
      await phoneContext.close();
    }
  });
});
