import { type Locator, type Page } from "@playwright/test";

export class OrgSettingCategoriesPage {
  readonly addCategoryButton: Locator;
  readonly categoryNameInput: Locator;
  readonly createCategoryButton: Locator;
  readonly nextButton: Locator;

  readonly editExistingCategoryButton: (categoryName: string) => Locator;
  /** In the edit dialog */
  readonly deleteTab: Locator;
  readonly deleteCategoryButton: Locator;

  constructor(public readonly page: Page) {
    this.addCategoryButton = page.getByRole("button", { name: "Add Category" });
    this.categoryNameInput = page.getByRole("textbox", { name: "Name" });
    this.createCategoryButton = page.getByRole("button", {
      name: "Create",
      exact: true,
    });
    this.nextButton = page.getByRole("button", { name: "Next" });

    this.editExistingCategoryButton = (categoryName: string) =>
      page
        .getByRole("row", { name: categoryName })
        .getByRole("button", { name: "Edit category" });
    this.deleteTab = page.getByRole("tab", { name: "Delete" });
    this.deleteCategoryButton = page.getByRole("button", {
      name: "Delete category",
    });
  }

  /** Steps through the new category dialog, leaving the rest as is */
  async createCategory(name: string) {
    await this.addCategoryButton.click();
    await this.categoryNameInput.fill(name);
    await this.nextButton.click();
    await this.nextButton.click();
    await this.createCategoryButton.click();
  }
}
