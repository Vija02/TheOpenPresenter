import { type Locator, type Page } from "@playwright/test";

export class ScreenControlPage {
  readonly openProjectHeading: Locator;
  readonly createTemporaryProjectButton: Locator;
  readonly endSessionButton: Locator;
  readonly adminPanelButton: Locator;

  // "Currently showing" card (only rendered when a project is assigned)
  readonly currentlyShowingLabel: Locator;
  readonly clearScreenButton: Locator;
  readonly openProjectButton: Locator;

  // Picker controls (only rendered for logged-in users)
  readonly showOtherOrgsButton: Locator;
  readonly newProjectDropdownButton: Locator;
  readonly showingNowBadge: Locator;

  // Sign-in alert (only rendered for non-logged-in guests)
  readonly signInAlert: Locator;

  constructor(public readonly page: Page) {
    this.openProjectHeading = page.getByRole("heading", {
      name: "Open a project",
    });
    this.createTemporaryProjectButton = page.getByRole("button", {
      name: "Create temporary project",
    });
    this.endSessionButton = page.getByRole("button", { name: "End session" });
    this.adminPanelButton = page.getByRole("button", { name: "Admin panel" });

    this.currentlyShowingLabel = page.getByText("Currently showing", {
      exact: true,
    });
    this.clearScreenButton = page.getByRole("button", { name: "Clear screen" });
    this.openProjectButton = page.getByRole("button", {
      name: "Open project",
      exact: true,
    });

    this.showOtherOrgsButton = page.getByRole("button", {
      name: "Show projects from other organizations",
    });
    this.newProjectDropdownButton = page.getByRole("button", {
      name: "New",
      exact: true,
    });
    this.showingNowBadge = page.getByText("Showing now", { exact: true });

    this.signInAlert = page
      .getByRole("alert")
      .filter({ hasText: "Sign in to pick from your projects" });
  }

  orgHeading(orgName: string): Locator {
    return this.page.getByRole("heading", { name: orgName, exact: true });
  }

  async goto(orgSlug: string, screenSlug: string) {
    await this.page.goto(`/o/${orgSlug}/screens/${screenSlug}/control`);
  }
}
