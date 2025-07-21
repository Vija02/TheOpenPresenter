import { type Locator, type Page } from "@playwright/test";

export class LyricsPlugin {
  readonly searchSongTitleInput: Locator;
  readonly addToListFormButton: Locator;

  constructor(public readonly page: Page) {
    this.searchSongTitleInput = page.getByRole("textbox", {
      name: "Song title...",
    });
    this.addToListFormButton = page.getByRole("button", {
      name: "Add to list",
    });
  }

  async addSong(songName: string) {
    const addSongButton = await Promise.race([
      this.page.waitForSelector(`[data-testid="ly-landing-add-song"]`),
      this.page.waitForSelector(`[data-testid="ly-add-song"]`),
    ]);

    await addSongButton.click();

    await this.searchSongTitleInput.fill(songName);

    await this.page
      .getByRole("paragraph")
      .filter({ hasText: songName })
      .click();

    await this.addToListFormButton.click();
  }
}
