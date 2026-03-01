import { type Locator, type Page } from "@playwright/test";

export class LyricsPlugin {
  readonly searchSongTitleInput: Locator;
  readonly addToListFormButton: Locator;
  readonly styleButton: Locator;
  readonly saveStyleButton: Locator;

  constructor(public readonly page: Page) {
    this.searchSongTitleInput = page.getByRole("textbox", {
      name: "Song title...",
    });
    this.addToListFormButton = page.getByRole("button", {
      name: "Add to list",
    });
    this.styleButton = page.getByRole("button", { name: "Style" });
    this.saveStyleButton = page.getByRole("button", { name: "Save" });
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

  async addCustomSong(
    title: string,
    content: string,
    displayType: "sections" | "fullSong" = "sections",
  ) {
    const addSongButton = await Promise.race([
      this.page.waitForSelector(`[data-testid="ly-landing-add-song"]`),
      this.page.waitForSelector(`[data-testid="ly-add-song"]`),
    ]);

    await addSongButton.click();

    await this.page.getByRole("button", { name: "Create a new song" }).click();

    await this.page.getByLabel("Title").fill(title);

    if (displayType === "fullSong") {
      await this.page.getByText("Full Song").click();
    }

    const editor = this.page.getByTestId("ly-song-editor");
    await editor.click();
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.press("Backspace");
    await editor.pressSequentially(content);

    await this.addToListFormButton.click();
  }

  async openStyleSettings() {
    await this.styleButton.click();
  }

  async setTheme(theme: "Dark" | "Light") {
    const combobox = this.page
      .getByTestId("form-item-isDarkMode")
      .getByRole("combobox")
      .locator("..");

    await combobox.click();
    await this.page.getByRole("option", { name: theme }).click();
  }

  async setVerticalAlign(align: "top" | "center" | "bottom") {
    await this.page.getByLabel(`Align ${align}`).click();
  }

  async toggleBold() {
    await this.page.getByLabel("Toggle bold").click();
  }

  async toggleItalic() {
    await this.page.getByLabel("Toggle italic").click();
  }

  async setAutoSize(autoSize: boolean) {
    if (autoSize) {
      await this.page.getByText("Auto fit").click();
    } else {
      await this.page.getByText("Manual", { exact: true }).click();
    }
  }

  async setFontSize(size: number) {
    await this.page
      .getByTestId("form-item-fontSize")
      .locator("input")
      .fill(size.toString());
  }

  async setPadding(padding: number) {
    await this.page
      .getByTestId("form-item-padding")
      .locator("input")
      .fill(padding.toString());
  }

  async togglePaddingLink() {
    await this.page
      .getByTestId("form-item-paddingIsLinked")
      .getByRole("button")
      .click();
  }

  async setIndividualPadding(padding: {
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
  }) {
    if (padding.left !== undefined) {
      await this.page
        .getByTestId("form-item-leftPadding")
        .locator("input")
        .fill(padding.left.toString());
    }
    if (padding.top !== undefined) {
      await this.page
        .getByTestId("form-item-topPadding")
        .locator("input")
        .fill(padding.top.toString());
    }
    if (padding.right !== undefined) {
      await this.page
        .getByTestId("form-item-rightPadding")
        .locator("input")
        .fill(padding.right.toString());
    }
    if (padding.bottom !== undefined) {
      await this.page
        .getByTestId("form-item-bottomPadding")
        .locator("input")
        .fill(padding.bottom.toString());
    }
  }

  async saveStyleSettings() {
    await this.saveStyleButton.click();
  }
}
