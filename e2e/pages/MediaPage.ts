import { type Locator, type Page } from "@playwright/test";

export class MediaPage {
  readonly uploadButton: Locator;
  readonly mediaGrid: Locator;
  readonly mediaCards: Locator;

  // Uppy Dashboard elements
  readonly uppyDashboard: Locator;

  constructor(public readonly page: Page) {
    this.uploadButton = page.getByRole("button", { name: "Upload" });
    this.mediaGrid = page.locator(
      ".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3",
    );
    this.mediaCards = page.locator(
      ".grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3 > div",
    );

    // Uppy Dashboard
    this.uppyDashboard = page.locator(".uppy-Dashboard");
  }

  async goto(orgSlug: string) {
    await this.page.goto(`/o/${orgSlug}/media`);
  }

  getMediaCardByName(name: string): Locator {
    return this.mediaCards.filter({ hasText: name });
  }

  getProcessingStatus(mediaCard: Locator): Locator {
    return mediaCard.locator(".ui--media-preview-processing-text");
  }

  getCompleteBadge(mediaCard: Locator): Locator {
    return mediaCard.locator("text=Complete");
  }
}
