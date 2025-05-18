import { type Locator, type Page } from "@playwright/test";

export class OrganizationPage {
  readonly newProjectButton: Locator;
  readonly newProjectSaveButton: Locator;
  readonly projectCards: Locator;

  constructor(public readonly page: Page) {
    this.newProjectButton = page.getByRole("button", {
      name: "New",
      exact: true,
    });
    this.newProjectSaveButton = page.getByRole("button", {
      name: "Save",
    });
    this.projectCards = page.getByTestId("project-card");
  }
}
