import { type ElectronApplication, expect, test } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";

import {
  type DesktopSettings,
  launchDesktop,
  readSettings,
  windowFor,
} from "../../helpers/desktopApp";
import { type JoinHost, freePort, startJoinHost } from "../../helpers/joinHost";

/**
 * Joining another computer over iroh: finding it, joining it, getting it back
 * after a restart, and what the app shows while it's away.
 *
 * Each test shares a real `top-studio-helper` from its own data folder, so
 * these use the network: the helper reaches iroh's relay and DNS, and the
 * first test needs mDNS on the machine running it.
 */

// Hosts are found by name, and parallel tests share the network.
const hostName = (label: string) =>
  `${label} ${Math.random().toString(36).slice(2, 7)}`;

/** The joined computer's app, served here on `port`. */
async function appPage(app: ElectronApplication, port: number) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const page = app
      .windows()
      .find((win) => win.url().startsWith(`http://localhost:${port}/`));
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`The app never opened localhost:${port}`);
}

/** Pages open in the main process, overlays and views included. */
async function shellPages(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(({ webContents }) =>
    webContents
      .getAllWebContents()
      .map((contents: { getURL(): string }) => contents.getURL()),
  );
}

const disconnectedShowing = async (app: ElectronApplication) =>
  (await shellPages(app)).some((url) => url.includes("disconnected.html"));

/** As if `host` was joined before, on `port`. */
const joinedTo = (host: JoinHost, port: number): DesktopSettings => ({
  mode: "selfhosted",
  rootUrl: `http://localhost:${port}`,
  computers: [{ peer: host.id, name: host.name, port }],
});

test.describe("joining another computer", () => {
  test("joins a computer found on this network from the first setup page", async () => {
    const host = await startJoinHost(hostName("Front of house"));
    const { app, root, close } = await launchDesktop();
    try {
      const setup = await windowFor(app, "onboarding");
      // Hidden until something is found, then offered quietly.
      const found = setup.getByText(host.name, { exact: true });
      await expect(found).toBeVisible({ timeout: 30_000 });
      await expect(
        setup.getByText("Or use a computer on this network"),
      ).toBeVisible();

      await found.click();

      await expect
        .poll(() => readSettings(root).computers?.[0]?.peer, {
          timeout: 30_000,
        })
        .toBe(host.id);
      const saved = readSettings(root);
      const port = saved.computers![0]!.port;
      const page = await appPage(app, port);
      await expect(page.locator("#host-page")).toContainText(host.name);
      expect(saved.rootUrl).toBe(`http://localhost:${port}`);
    } finally {
      await close();
      await host.close();
    }
  });

  test("rejoins a saved computer at launch, on the same address", async () => {
    const host = await startJoinHost(hostName("Saved"));
    const port = await freePort();
    const { app, close } = await launchDesktop(joinedTo(host, port));
    try {
      const page = await appPage(app, port);
      await expect(page.locator("#host-page")).toContainText(host.name);
    } finally {
      await close();
      await host.close();
    }
  });

  test("adds a computer by its code in Settings, and a bad one leaves the current one working", async () => {
    test.setTimeout(120_000);
    const first = await startJoinHost(hostName("First"));
    const second = await startJoinHost(hostName("Second"));
    const port = await freePort();
    const { app, root, close } = await launchDesktop(joinedTo(first, port));
    try {
      const page = await appPage(app, port);
      await page.evaluate(() =>
        (
          window as unknown as {
            theOpenPresenterDesktop: { invoke: (c: string) => Promise<void> };
          }
        ).theOpenPresenterDesktop.invoke("app:open-settings"),
      );
      const settings = await windowFor(app, "panel");
      await settings.getByRole("button", { name: "Add account" }).click();
      await settings.getByText("Another computer or server").click();
      const address = settings.getByRole("dialog").getByRole("textbox");

      // A computer that doesn't exist: a real ID nobody is using.
      const nobody = Buffer.from(
        generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x!,
        "base64url",
      ).toString("hex");
      await address.fill(nobody);
      await settings.getByRole("button", { name: "Connect" }).click();
      await expect(
        settings.getByText("Couldn't reach that computer"),
      ).toBeVisible({ timeout: 30_000 });
      // The tunnel to the computer in use was put back.
      expect(
        await page.evaluate(() =>
          fetch(location.origin + "/").then((r) => r.status),
        ),
      ).toBe(200);
      expect(readSettings(root).computers).toHaveLength(1);

      await address.fill(second.ticket);
      await settings.getByRole("button", { name: "Connect" }).click();
      await expect
        .poll(() => readSettings(root).computers?.length, { timeout: 30_000 })
        .toBe(2);
      const now = readSettings(root);
      const joined = now.computers!.find((c) => c.peer === second.id)!;
      expect(now.rootUrl).toBe(`http://localhost:${joined.port}`);
      const secondPage = await appPage(app, joined.port);
      await expect(secondPage.locator("#host-page")).toContainText(second.name);
    } finally {
      await close();
      await first.close();
      await second.close();
    }
  });

  test("opens a computer that was off at launch once it's back", async () => {
    test.setTimeout(120_000);
    const host = await startJoinHost(hostName("Late"));
    await host.stopSharing();
    const port = await freePort();
    const { app, close } = await launchDesktop(joinedTo(host, port));
    try {
      const screen = await windowFor(app, "unreachable", 45_000);
      await expect(screen.locator("h1")).toContainText(host.name);

      await host.share();
      const page = await appPage(app, port);
      await expect(page.locator("#host-page")).toContainText(host.name);
      await expect
        .poll(async () =>
          (await shellPages(app)).some((url) =>
            url.includes("unreachable.html"),
          ),
        )
        .toBe(false);
    } finally {
      await close();
      await host.close();
    }
  });

  test("covers the window while the computer is away, and clears without a reload after a short drop", async () => {
    test.setTimeout(120_000);
    const host = await startJoinHost(hostName("Blip"));
    const port = await freePort();
    const { app, close } = await launchDesktop(joinedTo(host, port));
    try {
      const page = await appPage(app, port);
      await page.goto(`http://localhost:${port}/o/church/sunday`);
      await page.evaluate(() => {
        (window as unknown as { kept: boolean }).kept = true;
      });

      await host.stopSharing();
      await expect.poll(() => disconnectedShowing(app)).toBe(true);
      // Over the page, not instead of it.
      expect(page.url()).toContain("/o/church/sunday");

      await host.share();
      await expect
        .poll(() => disconnectedShowing(app), { timeout: 45_000 })
        .toBe(false);
      expect(
        await page.evaluate(
          () => (window as unknown as { kept?: boolean }).kept,
        ),
      ).toBe(true);
    } finally {
      await close();
      await host.close();
    }
  });

  test("notices a host that died without a goodbye, and comes back to the same page", async () => {
    test.setTimeout(150_000);
    const host = await startJoinHost(hostName("Power cut"));
    const port = await freePort();
    const { app, close } = await launchDesktop(joinedTo(host, port));
    try {
      const page = await appPage(app, port);
      await page.goto(`http://localhost:${port}/o/church/sunday`);

      host.kill();
      // Only the idle timeout can tell: about 10s.
      await expect
        .poll(() => disconnectedShowing(app), { timeout: 30_000 })
        .toBe(true);

      await host.restart();
      await expect
        .poll(() => disconnectedShowing(app), { timeout: 45_000 })
        .toBe(false);
      await expect(page.locator("#host-page")).toContainText(
        "/o/church/sunday",
      );
    } finally {
      await close();
      await host.close();
    }
  });

  test("reloads the same page after a long drop", async () => {
    test.setTimeout(150_000);
    const host = await startJoinHost(hostName("Long"));
    const port = await freePort();
    const { app, close } = await launchDesktop(joinedTo(host, port));
    try {
      const page = await appPage(app, port);
      await page.goto(`http://localhost:${port}/o/church/sunday`);
      await page.evaluate(() => {
        (window as unknown as { kept: boolean }).kept = true;
      });

      await host.stopSharing();
      await expect.poll(() => disconnectedShowing(app)).toBe(true);
      // Past the point where the app's own connections give up.
      await new Promise((resolve) => setTimeout(resolve, 16_000));
      await host.share();

      await expect
        .poll(() => disconnectedShowing(app), { timeout: 60_000 })
        .toBe(false);
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as { kept?: boolean }).kept),
        )
        .toBeUndefined();
      expect(page.url()).toContain("/o/church/sunday");
    } finally {
      await close();
      await host.close();
    }
  });
});
