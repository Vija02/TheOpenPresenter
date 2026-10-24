import type { BrowserContext, Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

import { expect, test } from "../../../../../fixtures/projectFixture";
import { pressSettle } from "../../../../../helpers/slidesRenderer";
import { buildGoogleSlidesScene } from "../../../../../helpers/slidesSeed";
import { orgUrl, projectUrl, tagged } from "../../../../../helpers/workerData";

// Checks the Google Slides embed still renders with no internet, once it has
// been viewed online. Anything it still needs from the internet is listed in
// the failure message.

const SCENE = buildGoogleSlidesScene();
const IMPORT_ID = Object.keys(SCENE.pluginData.imports)[0];
const SLIDE_COUNT: number =
  SCENE.pluginData.imports[IMPORT_ID].slideClickCounts.length;

// Same-origin routes that reach Google from the server. `gscripts` no longer
// exists, so any request to it means a deck still points at it.
const PASSTHROUGH = [/^\/plugin\/slides\/gslide\/(gscripts|userUploads)\//];

// Blocked offline without affecting the render.
const HARMLESS = [
  /^https:\/\/play\.google\.com\/log\b/, // telemetry
  /^https:\/\/csp\.withgoogle\.com\//, // CSP violation reports
  /^https:\/\/ssl\.gstatic\.com\/docs\/common\/netcheck\.gif/, // connectivity probe
  /^https:\/\/example\.com\/e2e-slide-/, // the seed's fake thumbnails
];

/** Abort every request that would need the internet; returns what was blocked. */
async function goOffline(context: BrowserContext, appOrigin: string) {
  const blocked = new Set<string>();
  const essential = new Set<string>();
  // Routing also disables the HTTP cache, so nothing is served from the
  // browser's memory of the online run.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const needsInternet =
      (url.protocol.startsWith("http") && url.origin !== appOrigin) ||
      (url.origin === appOrigin &&
        PASSTHROUGH.some((re) => re.test(url.pathname)));
    if (needsInternet) {
      const entry = `${route.request().resourceType()} ${url.href.slice(0, 200)}`;
      blocked.add(entry);
      if (!HARMLESS.some((re) => re.test(url.href))) essential.add(entry);
      return route.abort("internetdisconnected");
    }
    return route.continue();
  });
  return { blocked, essential };
}

/** Step through every slide, then back, so the deck ends where it started. */
async function walkDeck(pp: Page) {
  const presses = SLIDE_COUNT * 4;
  for (let i = 0; i < presses; i++) await pressSettle(pp, "ArrowRight", 300);
  for (let i = 0; i < presses; i++) await pressSettle(pp, "ArrowLeft", 300);
  await pp.waitForTimeout(1000);
}

test.describe("Slides Plugin - Google Slides offline", () => {
  test.beforeEach(async ({ e2eCommand }) => await e2eCommand.clearWorkerData());

  test("renders from the proxy cache without internet", async ({
    page,
    context,
    projectPage,
    e2eCommand,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "chromium only");
    test.setTimeout(3 * 60 * 1000);

    await e2eCommand.loginWithScenes({
      next: orgUrl(tagged("testgslideoffline")),
      orgs: [
        {
          name: "TestOrg",
          slug: tagged("testgslideoffline"),
          projects: [
            { name: "TestProject", slug: "testproject", scenes: [SCENE] },
          ],
        },
      ],
    });

    // ── Online: view the deck once so the cache fills ────────────────────
    await page.goto(projectUrl(tagged("testgslideoffline")));
    const pp = await projectPage.present();
    const frame = pp.locator("iframe");
    // The renderer's fullscreen button shows for 1.5s after the pointer moves,
    // so whether it's in a screenshot is down to timing
    const shoot = () =>
      frame.screenshot({
        mask: [pp.locator("button[aria-label$='fullscreen']")],
      });
    await expect(frame).toBeVisible({ timeout: 30 * 1000 });
    await pp.click("body");
    await pp.waitForLoadState("networkidle");
    await pp.waitForTimeout(1000);
    await walkDeck(pp);
    const online = await shoot();

    // ── Offline: reload everything with the internet cut off ─────────────
    const { blocked, essential } = await goOffline(
      context,
      new URL(baseURL!).origin,
    );
    const proxyCache: string[] = [];
    pp.on("response", (res) => {
      if (res.url().includes("/proxy-cache/")) {
        proxyCache.push(`${res.status()} ${res.headers()["x-proxy-cache"]}`);
      }
    });

    await page.reload();
    await pp.reload();
    await expect(frame).toBeVisible({ timeout: 30 * 1000 });
    await pp.click("body");
    await pp.waitForLoadState("networkidle");
    await pp.waitForTimeout(1000);
    const offline = await shoot();
    await walkDeck(pp);

    const report = {
      "online.png": online,
      "offline.png": offline,
      "blocked.txt": Buffer.from([...blocked].sort().join("\n") || "(none)"),
    };
    for (const [name, body] of Object.entries(report)) {
      const path = testInfo.outputPath(name);
      writeFileSync(path, body);
      await testInfo.attach(name, { path });
    }

    expect(
      proxyCache.length,
      "no request went through the proxy cache",
    ).toBeGreaterThan(0);
    expect(
      proxyCache.every((r) => r === "200 HIT"),
      proxyCache.join(", "),
    ).toBe(true);
    expect(offline.equals(online), "offline render differs from online").toBe(
      true,
    );
    expect(
      [...essential].sort(),
      "requests that still need the internet",
    ).toEqual([]);
  });
});
