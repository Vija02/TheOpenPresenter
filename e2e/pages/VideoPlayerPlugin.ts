import { type Locator, type Page, expect } from "@playwright/test";

export class VideoPlayerPlugin {
  readonly searchInput: Locator;
  readonly goButton: Locator;
  readonly videos: Locator;
  readonly nowPlaying: Locator;

  constructor(public readonly page: Page) {
    this.searchInput = page.getByRole("textbox", {
      name: "Search YouTube or paste a link...",
    });
    this.goButton = page.getByRole("button", { name: "Go", exact: true });
    this.videos = page.getByTestId("playlist-video");
    this.nowPlaying = page.getByTestId("now-playing");
  }

  /** Searches YouTube and picks the result with this title */
  async addFromSearch(title: string) {
    await this.searchInput.fill(title);
    await this.goButton.click();
    const dialog = this.page.getByRole("dialog");
    await dialog.getByText(title, { exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(this.video(title)).toBeVisible();
  }

  video(title: string): Locator {
    return this.videos.filter({ hasText: title });
  }

  playVideoButton(title: string): Locator {
    return this.page.getByRole("button", { name: `Play ${title}` });
  }

  /** Drags a video by its handle onto another video's position */
  async dragVideo(title: string, ontoTitle: string) {
    const handle = await this.page
      .getByRole("button", { name: `Reorder ${title}` })
      .boundingBox();
    const target = await this.video(ontoTitle).boundingBox();
    if (!handle || !target) throw new Error("Video has no bounding box");

    const x = handle.x + handle.width / 2;
    await this.page.mouse.move(x, handle.y + handle.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(x, target.y + target.height / 2, { steps: 10 });
    await this.page.mouse.up();
    // dnd-kit swallows clicks for 50ms after a drop, so a drop isn't a click
    await this.page.waitForTimeout(100);
  }

  /** The YouTube player on an output screen */
  static rendererVideo(rendererPage: Page, videoId: string): Locator {
    return rendererPage.locator(`iframe[src*="/embed/${videoId}"]`);
  }
}
