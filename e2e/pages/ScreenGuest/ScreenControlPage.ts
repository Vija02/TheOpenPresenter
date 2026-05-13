import { type Locator, type Page } from "@playwright/test";

export class ScreenControlPage {
  readonly pickProjectHeading: Locator;
  readonly createTemporaryProjectButton: Locator;

  constructor(public readonly page: Page) {
    this.pickProjectHeading = page.getByRole("heading", {
      name: "Pick a project",
    });
    this.createTemporaryProjectButton = page.getByRole("button", {
      name: "Create temporary project",
    });
  }

  async goto(orgSlug: string, screenSlug: string) {
    await this.page.goto(`/o/${orgSlug}/screens/${screenSlug}/control`);
  }
}
