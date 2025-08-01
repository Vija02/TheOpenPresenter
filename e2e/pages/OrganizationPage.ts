import { type Locator, type Page } from "@playwright/test";

export class OrganizationPage {
  readonly newProjectButton: Locator;
  readonly importButton: Locator;
  readonly importCloseButton: Locator;
  readonly newProjectSaveButton: Locator;
  readonly projectCards: Locator;

  constructor(public readonly page: Page) {
    this.newProjectButton = page.getByRole("button", {
      name: "New",
      exact: true,
    });
    this.importButton = page.getByRole("button", {
      name: "Import",
      exact: true,
    });
    this.importCloseButton = page.getByLabel("Close");
    this.newProjectSaveButton = page.getByRole("button", {
      name: "Save",
    });
    this.projectCards = page.getByTestId("project-card");
  }
}
