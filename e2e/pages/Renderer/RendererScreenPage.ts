import { type Locator, type Page } from "@playwright/test";

export class RendererScreenPage {
  readonly idleMessage: Locator;
  readonly currentScene: Locator;
  readonly lyricsContainer: Locator;

  constructor(public readonly page: Page) {
    this.idleMessage = page.getByText("Waiting for a project");
    this.currentScene = page.getByTestId("current-scene");
    this.lyricsContainer = page.locator("#pl-lyrics-presenter");
  }

  async goto(orgSlug: string, screenSlug: string) {
    await this.page.goto(`/render/s/${orgSlug}/${screenSlug}`);
  }
}
