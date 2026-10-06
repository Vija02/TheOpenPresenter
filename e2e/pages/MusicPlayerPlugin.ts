import { type Locator, type Page } from "@playwright/test";

export class MusicPlayerPlugin {
  readonly input: Locator;
  readonly goButton: Locator;
  readonly tracks: Locator;
  readonly nowPlaying: Locator;
  readonly radioTab: Locator;

  constructor(public readonly page: Page) {
    this.input = page.getByPlaceholder("Search YouTube or paste a link...");
    this.goButton = page.getByRole("button", { name: "Go", exact: true });
    this.tracks = page.getByTestId("playlist-track");
    this.nowPlaying = page.getByTestId("now-playing");
    this.radioTab = page.getByRole("tab", { name: "Radio" });
  }

  async submit(value: string) {
    await this.input.fill(value);
    await this.goButton.click();
  }

  track(title: string): Locator {
    return this.tracks.filter({ hasText: title });
  }

  playTrackButton(title: string): Locator {
    return this.page.getByRole("button", { name: `Play ${title}` });
  }

  /** Drags a track by its handle onto another track's position */
  async dragTrack(title: string, ontoTitle: string) {
    const handle = await this.page
      .getByRole("button", { name: `Reorder ${title}` })
      .boundingBox();
    const target = await this.track(ontoTitle).boundingBox();
    if (!handle || !target) throw new Error("Track has no bounding box");

    const x = handle.x + handle.width / 2;
    await this.page.mouse.move(x, handle.y + handle.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(x, target.y + target.height / 2, { steps: 10 });
    await this.page.mouse.up();
  }

  /** The hidden YouTube player on an output screen */
  static rendererTrack(rendererPage: Page, videoId: string): Locator {
    return rendererPage.locator(`iframe[src*="/embed/${videoId}"]`);
  }
}
