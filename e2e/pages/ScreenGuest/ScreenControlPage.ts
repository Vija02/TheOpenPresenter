import { type Locator, type Page } from "@playwright/test";

export class ScreenControlPage {
  readonly pickProjectHeading: Locator;
  readonly createTemporaryProjectButton: Locator;
  readonly endSessionButton: Locator;
  readonly adminPanelButton: Locator;

  constructor(public readonly page: Page) {
    this.pickProjectHeading = page.getByRole("heading", {
      name: "Pick a project",
    });
    this.createTemporaryProjectButton = page.getByRole("button", {
      name: "Create temporary project",
    });
    this.endSessionButton = page.getByRole("button", { name: "End session" });
    this.adminPanelButton = page.getByRole("button", { name: "Admin panel" });
  }

  async goto(orgSlug: string, screenSlug: string) {
    await this.page.goto(`/o/${orgSlug}/screens/${screenSlug}/control`);
  }
}
