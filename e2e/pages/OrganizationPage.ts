import { type Locator, type Page } from "@playwright/test";

export class OrganizationPage {
  readonly newProjectButton: Locator;
  readonly importButton: Locator;
  readonly importCloseButton: Locator;
  readonly newProjectSaveButton: Locator;
  readonly projectCards: Locator;
  readonly projectCardEditButtonNth: (nth?: number) => Locator;
  readonly projectCardMenuButtonNth: (nth?: number) => Locator;
  readonly projectCardDeleteButtonNth: (nth?: number) => Locator;
  readonly projectCardMenuDuplicate: Locator;
  readonly projectCardMenuRenderer: Locator;
  readonly projectCardMenuAssignToScreen: Locator;
  readonly projectCardMenuScreen: (name: string) => Locator;

  readonly duplicateModalNameInput: Locator;
  readonly duplicateModalConfirmButton: Locator;

  readonly projectEditModalNameInput: Locator;
  readonly projectEditModalTargetDateInput: Locator;
  readonly projectEditModalCategoryInput: Locator;
  readonly projectEditModalCategoryOption: (option: string) => Locator;
  readonly projectEditModalTagsInput: Locator;
  readonly projectEditModalTagsOption: (option: string) => Locator;
  readonly projectEditModalTagsRemove: (nth?: number) => Locator;
  readonly projectEditModalSaveButton: Locator;

  constructor(public readonly page: Page) {
    this.newProjectButton = page.getByRole("button", {
      name: "New",
      exact: true,
    });
    this.importButton = page.getByRole("button", {
      name: "Import",
      exact: true,
    });
    this.importCloseButton = page
      .getByRole("button", { name: "Close" })
      .first();
    this.newProjectSaveButton = page.getByRole("button", {
      name: "Save",
    });

    this.projectCards = page.locator("[data-testid=project-card]");
    this.projectCardMenuButtonNth = (nth = 0) =>
      page
        .locator("[data-testid=project-card]")
        .nth(nth)
        .locator("[data-testid=project-card-menu]");
    this.projectCardEditButtonNth = (nth = 0) =>
      page
        .locator("[data-testid=project-card]")
        .nth(nth)
        .getByRole("button", { name: "Edit project" });
    this.projectCardDeleteButtonNth = (nth = 0) =>
      page
        .locator("[data-testid=project-card]")
        .nth(nth)
        .getByRole("button", { name: "Delete project" });
    this.projectCardMenuDuplicate = page.getByRole("button", {
      name: "Duplicate project",
    });
    this.projectCardMenuRenderer = page.getByRole("link", {
      name: "Open renderer",
    });
    this.projectCardMenuAssignToScreen = page.getByRole("button", {
      name: "Assign to screen",
    });
    this.projectCardMenuScreen = (name: string) =>
      page.getByRole("button", { name });

    // Duplicate modal
    this.duplicateModalNameInput = page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Name" });
    this.duplicateModalConfirmButton = page.getByRole("button", {
      name: "Duplicate",
      exact: true,
    });

    // Edit modal
    this.projectEditModalNameInput = page.getByRole("textbox", {
      name: "Name",
    });
    this.projectEditModalTargetDateInput = page
      .getByTestId("form-item-targetDate")
      .getByRole("combobox");
    this.projectEditModalCategoryInput = page
      .getByTestId("form-item-categoryId")
      .getByRole("combobox");
    this.projectEditModalCategoryOption = (option: string) =>
      page.getByRole("option", { name: option });
    this.projectEditModalTagsInput = page
      .getByTestId("tag-selector")
      .getByRole("combobox");
    this.projectEditModalTagsOption = (option: string) =>
      page.getByRole("option", { name: option });
    this.projectEditModalTagsRemove = (nth = 0) =>
      page.locator("[data-testid=tag-remove]").nth(nth);
    this.projectEditModalSaveButton = page.getByRole("button", {
      name: "Save",
    });
  }
}
