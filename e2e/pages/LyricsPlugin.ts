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
    this.styleButton = page.getByRole("button", { name: "Style", exact: true });
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

  // Tab navigation
  async goToTextTab() {
    await this.page.getByRole("tab", { name: "Text" }).click();
  }

  async goToPlacementTab() {
    await this.page.getByRole("tab", { name: "Placement" }).click();
  }

  async goToBackgroundTab() {
    await this.page.getByRole("tab", { name: "Background" }).click();
  }

  // Text tab methods
  async setTextColor(color: string) {
    await this.goToTextTab();
    const colorInput = this.page
      .getByTestId("form-item-textColor")
      .locator("input");
    await colorInput.fill(color);
  }

  async toggleTextShadow() {
    await this.goToTextTab();
    await this.page.getByLabel("Text Shadow").click();
  }

  async toggleTextOutline() {
    await this.goToTextTab();
    await this.page.getByLabel("Text Outline").click();
  }

  async setVerticalAlign(align: "top" | "center" | "bottom") {
    await this.goToPlacementTab();
    await this.page.getByLabel(`Align ${align}`).click();
  }

  async toggleBold() {
    await this.goToTextTab();
    await this.page.getByLabel("Toggle bold").click();
  }

  async toggleItalic() {
    await this.goToTextTab();
    await this.page.getByLabel("Toggle italic").click();
  }

  async setAutoSize(autoSize: boolean) {
    await this.goToTextTab();
    if (autoSize) {
      await this.page.getByText("Auto fit").click();
    } else {
      await this.page.getByText("Manual", { exact: true }).click();
    }
  }

  async setFontSize(size: number) {
    await this.goToTextTab();
    await this.page
      .getByTestId("form-item-fontSize")
      .locator("input")
      .fill(size.toString());
  }

  // Background tab methods
  async setBackgroundType(type: "Solid Color" | "Video") {
    await this.goToBackgroundTab();
    await this.page.getByTestId("form-item-backgroundType").click();
    await this.page.getByRole("option", { name: type }).click();
  }

  async setBackgroundColor(color: string) {
    await this.goToBackgroundTab();
    const colorInput = this.page
      .getByTestId("form-item-backgroundColor")
      .locator("input");
    await colorInput.fill(color);
  }

  // Placement tab methods
  async setPadding(padding: number) {
    await this.goToPlacementTab();
    await this.page
      .getByTestId("form-item-padding")
      .locator("input")
      .fill(padding.toString());
  }

  async togglePaddingLink() {
    await this.goToPlacementTab();
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
    await this.goToPlacementTab();
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
