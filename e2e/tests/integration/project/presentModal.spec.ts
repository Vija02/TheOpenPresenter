import { type Page } from "@playwright/test";

import { expect, test } from "../../../fixtures/screenFixture";
import {
  addOutput,
  expandOutput,
  openManageOutputs,
} from "../../../helpers/outputs";
import { WORKER_TAG } from "../../../helpers/workerData";
import { ProjectPage } from "../../../pages/ProjectPage";

const ORG_SLUG = `testorg-pmod-${WORKER_TAG}`;
const ORG_NAME = `TestOrg PMod ${WORKER_TAG}`;
const USERNAME = `testuser_pmod_${WORKER_TAG}`;
const PROJECT_NAME = "Present Modal Project";
const PROJECT_SLUG = "present-modal-project";
const PROJECT_URL = `/app/${ORG_SLUG}/${PROJECT_SLUG}`;
const PHONE = { width: 390, height: 844 };

const login = (e2eCommand: any) =>
  e2eCommand.login({
    username: USERNAME,
    orgs: [
      {
        name: ORG_NAME,
        slug: ORG_SLUG,
        owner: true,
        projects: [{ name: PROJECT_NAME, slug: PROJECT_SLUG }],
      },
    ],
  });

const openWindow = async (projectPage: ProjectPage) => {
  const { page } = projectPage;
  await projectPage.openPresentMenu();
  const popupPromise = page.waitForEvent("popup");
  await projectPage.openInNewTabLink.click();
  const popup = await popupPromise;
  await page.keyboard.press("Escape");
  return popup;
};

/** Records what the page shares or copies */
const stubShare = async (page: Page, { canShare }: { canShare: boolean }) => {
  await page.addInitScript((canShare) => {
    const w = window as any;
    w.__shared = [];
    w.__copied = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: canShare
        ? async (data: ShareData) => void w.__shared.push(data.url)
        : undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void w.__copied.push(text) },
    });
  }, canShare);
};

test.beforeEach(async ({ e2eCommand }) => {
  await e2eCommand.serverCommand("clearOrganizationBySlug", { slug: ORG_SLUG });
  await e2eCommand.serverCommand("clearUserByUsername", { username: USERNAME });
});

test.describe("Present modal", () => {
  test("only the sidebar can stop, and it asks first", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);

    const popup = await openWindow(projectPage);
    // The top bar's is hidden
    await expect(projectPage.stopAllPresentingButton).toHaveCount(1);

    await projectPage.stopAllPresentingButton.click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.waitForTimeout(500);
    expect(popup.isClosed()).toBe(false);

    const closed = popup.waitForEvent("close");
    await projectPage.stopAllPresentingButton.click();
    await page.getByTestId("popconfirm-confirm").click();
    await closed;
  });

  test("an output's row shows it's live and stops it", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);

    await openManageOutputs(page);
    await expandOutput(page, "Main");
    const row = page.getByTestId("output-1");
    await expect(row.getByText("Live", { exact: true })).toHaveCount(0);
    await expect(
      row.getByRole("button", { name: "Stop showing Main" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    const popup = await openWindow(projectPage);

    await openManageOutputs(page);
    await expandOutput(page, "Main");
    await expect(row.getByText("Live", { exact: true })).toBeVisible();

    const closed = popup.waitForEvent("close");
    await row.getByRole("button", { name: "Stop showing Main" }).click();
    await closed;
    await expect(row.getByText("Live", { exact: true })).toHaveCount(0);
  });

  test("virtual screen links open in a new tab", async ({
    page,
    context,
    e2eCommand,
    setupScreen,
  }) => {
    await login(e2eCommand);
    await setupScreen({
      orgSlug: ORG_SLUG,
      slug: `testscreen-pmod-${WORKER_TAG}`,
      name: "Lobby TV",
    });
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);
    await projectPage.openPresentMenu();

    await expect(
      page.getByRole("link", { name: "Virtual screen settings" }),
    ).toHaveAttribute("target", "_blank");
  });

  test("suggests Chrome or Studio where displays can't be picked", async ({
    page,
    context,
    e2eCommand,
    browserName,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);
    await projectPage.openPresentMenu();

    const otherBrowser = page.getByText("Want it straight on your projector?");
    const studio = page.getByText("Presenting every week?");
    if (browserName === "chromium") {
      await expect(studio).toBeVisible();
      await expect(otherBrowser).toHaveCount(0);
    } else {
      await expect(otherBrowser).toBeVisible();
      await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
      await expect(studio).toHaveCount(0);
    }
  });
});

test.describe("Present modal on a phone", () => {
  const openOnPhone = async (page: Page) => {
    await page.setViewportSize(PHONE);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Present", exact: true }).click();
  };

  test("focuses on virtual screens and the browser", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);
    await openManageOutputs(page);
    await addOutput(page, "Confidence monitor");
    await page.keyboard.press("Escape");

    await openOnPhone(page);

    await expect(page.getByText("On a virtual screen")).toBeVisible();
    await expect(page.getByText("In a web browser")).toBeVisible();
    await expect(page.getByText("Your displays")).toHaveCount(0);
    await expect(projectPage.openInNewTabLink).toContainText(
      "Opens it in a new tab",
    );

    const show = page.getByRole("combobox", { name: "Show" });
    await expect(show).toBeVisible();
    await expect(projectPage.openInNewTabLink).toHaveAttribute(
      "href",
      /renderer=1(&|$)/,
    );
    await show.selectOption({ label: "Confidence monitor" });
    await expect(projectPage.openInNewTabLink).toHaveAttribute(
      "href",
      /renderer=(?!1(&|$))[^&]+/,
    );
  });

  test("opens a tab without the fullscreen step", async ({
    page,
    context,
    e2eCommand,
  }) => {
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);
    await openOnPhone(page);

    const popupPromise = page.waitForEvent("popup");
    await projectPage.openInNewTabLink.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/\/render\//);

    await expect(page.getByRole("button", { name: /^Share link/ })).toBeVisible();
    await expect(projectPage.makeFullscreenButton).toHaveCount(0);
  });

  test("shares the link", async ({ page, e2eCommand }) => {
    await stubShare(page, { canShare: true });
    await login(e2eCommand);
    await page.goto(PROJECT_URL);
    await openOnPhone(page);

    await page.getByRole("button", { name: /^Share link/ }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__shared))
      .toEqual([
        expect.stringMatching(
          new RegExp(`^https?://[^/]+/render/${ORG_SLUG}/${PROJECT_SLUG}\\?.*renderer=1`),
        ),
      ]);
  });

  test("copies the link where it can't share", async ({
    page,
    e2eCommand,
  }) => {
    await stubShare(page, { canShare: false });
    await login(e2eCommand);
    await page.goto(PROJECT_URL);
    await openOnPhone(page);

    await page.getByRole("button", { name: /^Share link/ }).click();
    await expect(page.getByText("Link copied")).toBeVisible();
    const copied = await page.evaluate(() => (window as any).__copied);
    expect(copied).toEqual([
      expect.stringMatching(new RegExp(`/render/${ORG_SLUG}/${PROJECT_SLUG}\\?`)),
    ]);
  });
});

test.describe("Present modal in Studio", () => {
  /** Stands in for Studio's preload bridge, recording every call */
  const fakeStudio = async (page: Page) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.__calls = [];
      const replies: Record<string, unknown> = {
        "present:monitors": [
          {
            name: "Built-in Retina Display",
            width: 1512,
            height: 982,
            x: 0,
            y: 0,
            isPrimary: true,
            isCurrent: true,
          },
          { name: "EPSON PJ", width: 1920, height: 1080, x: 1512, y: 0 },
        ],
        "present:list": [],
        "host:local-address": "192.168.1.20",
        "host:check": true,
      };
      w.theOpenPresenterDesktop = {
        isDesktop: true,
        shell: "electron",
        platform: "darwin",
        invoke: async (channel: string, args?: unknown) => {
          w.__calls.push([channel, args]);
          return replies[channel] ?? null;
        },
        on: () => () => {},
      };
    });
  };
  const callsTo = (page: Page, channel: string) =>
    page.evaluate(
      (channel) =>
        (window as any).__calls
          .filter(([c]: [string]) => c === channel)
          .map(([, args]: [string, unknown]) => args),
      channel,
    );

  test("presents on one of Studio's displays", async ({
    page,
    context,
    e2eCommand,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Studio is Chromium");
    await fakeStudio(page);
    await login(e2eCommand);
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);
    await projectPage.openPresentMenu();

    await expect(page.getByText("Your displays")).toBeVisible();
    // Studio needs no download pitch
    await expect(page.getByText("Presenting every week?")).toHaveCount(0);

    await page.getByRole("button", { name: /EPSON PJ/ }).click();
    await expect
      .poll(() => callsTo(page, "present:open"))
      .toEqual([
        expect.objectContaining({
          url: expect.stringMatching(
            new RegExp(`/render/${ORG_SLUG}/${PROJECT_SLUG}\\?.*renderer=1`),
          ),
        }),
      ]);
  });

  test("opens browser links outside Studio, and its own pages in place", async ({
    page,
    context,
    e2eCommand,
    browserName,
    setupScreen,
  }) => {
    test.skip(browserName !== "chromium", "Studio is Chromium");
    await fakeStudio(page);
    await stubShare(page, { canShare: true });
    await login(e2eCommand);
    await setupScreen({
      orgSlug: ORG_SLUG,
      slug: `testscreen-pmod-${WORKER_TAG}`,
      name: "Lobby TV",
    });
    const projectPage = new ProjectPage(page, context);
    await page.goto(PROJECT_URL);
    await projectPage.openPresentMenu();

    await page.getByRole("link", { name: /^Open in your browser/ }).click();
    await expect
      .poll(() => callsTo(page, "app:open-external"))
      .toEqual([
        expect.stringMatching(
          new RegExp(`^http://localhost:\\d+/render/${ORG_SLUG}/${PROJECT_SLUG}\\?`),
        ),
      ]);

    // Other devices can't reach localhost
    await page.getByRole("button", { name: /^Share link/ }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__shared))
      .toEqual([expect.stringMatching(/^http:\/\/192\.168\.1\.20:\d+\/render\//)]);

    const settings = page.getByRole("link", {
      name: "Virtual screen settings",
    });
    await expect(settings).not.toHaveAttribute("target", "_blank");
    await settings.click({ force: true });
    await expect(page).toHaveURL(/\/screens\/.*\/admin/);
  });
});
