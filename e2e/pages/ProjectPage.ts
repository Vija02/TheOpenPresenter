import { type BrowserContext, type Locator, type Page } from "@playwright/test";

const pluginsList = [
  "Embed",
  "Slides",
  "Lyrics Presenter",
  "Timer",
  "Simple Image",
  "Video Player",
  "Audio Recorder",
  "Radio",
  "Worship Pads",
] as const;

export class ProjectPage {
  readonly newSceneButton: Locator;
  readonly newSceneAddButton: Locator;
  readonly presentButton: Locator;
  readonly addSceneModal: Locator;

  constructor(
    public readonly page: Page,
    public readonly context: BrowserContext,
  ) {
    this.newSceneButton = page.getByRole("button", { name: "Add New Scene" });
    this.newSceneAddButton = page.getByRole("button", { name: "Add Scene" });
    this.presentButton = page.getByRole("button", { name: "Present" });
    this.addSceneModal = page.getByLabel("Add scene");
  }

  async createPlugin(plugin: (typeof pluginsList)[number]) {
    await this.newSceneButton.click();

    await this.addSceneModal.getByText(plugin, { exact: true }).click();

    await this.newSceneAddButton.click();
  }

  pluginOption(plugin: (typeof pluginsList)[number]): Locator {
    return this.addSceneModal.getByText(plugin, { exact: true });
  }

  async present() {
    // The Present button opens a popover; "Open in new tab" is a link whose
    // href is the renderer URL.
    await this.openPresentMenu();
    const [newPage] = await Promise.all([
      this.context.waitForEvent("page"),
      this.openInNewTabLink.click(),
    ]);
    await newPage.waitForLoadState();
    return newPage;
  }

  // --- Present popover ---

  async openPresentMenu() {
    await this.presentButton.click();
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
