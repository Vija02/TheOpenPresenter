import { type Locator, type Page } from "@playwright/test";

export class OrganizationPage {
  readonly newProjectButton: Locator;
  readonly importButton: Locator;
  readonly importCloseButton: Locator;
  readonly newProjectSaveButton: Locator;
  readonly projectCards: Locator;
  readonly projectCardEditButtonNth: (nth?: number) => Locator;
  readonly projectCardPresentButtonNth: (nth?: number) => Locator;
  readonly projectCardDeleteButtonNth: (nth?: number) => Locator;

  readonly projectEditModalNameInput: Locator;
  readonly projectEditModalTargetDateInput: Locator;
  readonly projectEditModalCategoryInput: Locator;
  readonly projectEditModalCategoryOption: (option: string) => Locator;
  readonly projectEditModalTagsInput: Locator;
  readonly projectEditModalTagsOption: (option: string) => Locator;
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
    this.projectCardPresentButtonNth = (nth = 0) =>
      page
        .locator("[data-testid=project-card]")
        .nth(nth)
        .getByRole("button")
        .nth(0);
    this.projectCardEditButtonNth = (nth = 0) =>
      page
        .locator("[data-testid=project-card]")
        .nth(nth)
        .getByRole("button")
        .nth(1);
    this.projectCardDeleteButtonNth = (nth = 0) =>
      page
        .locator("[data-testid=project-card]")
        .nth(nth)
        .getByRole("button")
        .nth(2);

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
    this.projectEditModalSaveButton = page.getByRole("button", {
      name: "Save",
    });
  }
}
