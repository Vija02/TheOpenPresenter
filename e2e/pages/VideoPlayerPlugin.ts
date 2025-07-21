import { type Locator, type Page } from "@playwright/test";

export class VideoPlayerPlugin {
  readonly searchInput: Locator;

  constructor(public readonly page: Page) {
    this.searchInput = page.getByRole("textbox", {
      name: "Search...",
    });
  }
}
