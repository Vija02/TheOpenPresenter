import { type Locator, type Page } from "@playwright/test";

export class OrgSettingCategoriesPage {
  readonly addCategoryButton: Locator;
  readonly categoryNameInput: Locator;
  readonly createCategoryButton: Locator;

  readonly editExistingCategoryButton: (categoryName: string) => Locator;
  readonly deleteExistingCategoryButton: (categoryName: string) => Locator;

  constructor(public readonly page: Page) {
    this.addCategoryButton = page.getByRole("button", { name: "Add Category" });
    this.categoryNameInput = page.getByRole("textbox", { name: "Name" });
    this.createCategoryButton = page.getByRole("button", {
      name: "Create",
      exact: true,
    });

    this.editExistingCategoryButton = (categoryName: string) =>
      page.getByRole("row", { name: categoryName }).getByRole("button").nth(0);
    this.deleteExistingCategoryButton = (categoryName: string) =>
      page.getByRole("row", { name: categoryName }).getByRole("button").nth(1);
  }
}
