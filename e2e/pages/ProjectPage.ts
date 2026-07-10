import { type BrowserContext, type Locator, type Page } from "@playwright/test";

const pluginsList = [
  "Embed",
  "Slides",
  "Lyrics Presenter",
  "Timer",
  "Video Player",
  "Audio Recorder",
  "Radio",
  "Worship Pads",
] as const;

export class ProjectPage {
  readonly newSceneButton: Locator;
  readonly presentButton: Locator;

  constructor(
    public readonly page: Page,
    public readonly context: BrowserContext,
  ) {
    this.newSceneButton = page.getByTestId("add-scene");
    this.presentButton = page.getByRole("button", { name: "Present" });
  }

  async createPlugin(plugin: (typeof pluginsList)[number]) {
    await this.newSceneButton.click({ force: true });

    await this.page.getByText(plugin, { exact: true }).click({ force: true });
  }

  pluginOption(plugin: (typeof pluginsList)[number]): Locator {
    return this.page.getByText(plugin, { exact: true });
  }

  async present() {
    // The Present button opens a popover; "Open in new tab" is a link whose
    // href is the renderer URL.
    await this.openPresentMenu();
    const url = await this.openInNewTabLink.getAttribute("href");
    await this.closePresentMenu();
    const newPage = await this.context.newPage();
    await newPage.goto(url!);
    return newPage;
  }

  // --- Present popover ---

  async openPresentMenu() {
    await this.presentButton.click();
  }

  async closePresentMenu() {
    await this.page.keyboard.press("Escape");
    await this.openInNewTabLink.waitFor({ state: "hidden" });
  }

  get openInNewTabLink(): Locator {
    return this.page.getByRole("link", { name: "Open in new tab" });
  }

  /** A screen row's "present to this screen" button, matched by screen name. */
  presentScreenOption(screenName: string): Locator {
    return this.page.getByRole("button", { name: screenName });
  }

  get presentingHereIndicator(): Locator {
    return this.page.getByText("Presenting here");
  }

  get stopPresentingButton(): Locator {
    return this.page.getByRole("button", {
      name: "Stop presenting to this screen",
    });
  }

  get noScreensSetUpLink(): Locator {
    return this.page.getByRole("link", { name: "Set up a screen" });
  }
}
