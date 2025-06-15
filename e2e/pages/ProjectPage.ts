import { type Locator, type Page } from "@playwright/test";

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

  constructor(public readonly page: Page) {
    this.newSceneButton = page.getByRole("button", { name: "Add New Scene" });
    this.newSceneAddButton = page.getByRole("button", { name: "Add Scene" });
    this.presentButton = page.getByRole("button", { name: "Present" });
  }

  async createPlugin(plugin: (typeof pluginsList)[number]) {
    await this.newSceneButton.click();

    await this.page
      .getByLabel("Add scene")
      .getByText(plugin, { exact: true })
      .click();

    await this.newSceneAddButton.click();
  }

  async present() {
    const page2Promise = this.page.waitForEvent("popup");
    await this.presentButton.click();
    return await page2Promise;
  }
}
