import { type Locator, type Page } from "@playwright/test";

/** A card in the settings list; every card when no name is given */
export const categoryCard = (page: Page, name?: string) => {
  const cards = page
    .getByRole("list", { name: "Categories" })
    .getByRole("listitem");
  return name ? cards.filter({ hasText: name }) : cards;
};

/** A category choice in the new project dialog */
export const categoryOption = (scope: Page | Locator, name: string) =>
  scope
    .getByRole("radiogroup", { name: "Category" })
    .getByRole("radio", { name, exact: true });

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
      categoryCard(page, categoryName).getByRole("button", {
        name: "Edit category",
      });
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
