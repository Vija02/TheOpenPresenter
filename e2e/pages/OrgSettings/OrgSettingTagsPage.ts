import { type Locator, type Page } from "@playwright/test";

export class OrgSettingTagsPage {
  readonly addTagButton: Locator;
  readonly tagNameInput: Locator;
  readonly createButton: Locator;

  readonly editExistingTagButton: (tagName: string) => Locator;
  readonly deleteExistingTagButton: (tagName: string) => Locator;

  constructor(public readonly page: Page) {
    this.addTagButton = page
      .getByRole("button", { name: "Add Tag" })
      .or(page.getByRole("button", { name: "Create a Tag" }));
    this.tagNameInput = page.getByRole("textbox", { name: "Tag Name" });
    this.createButton = page.getByRole("button", {
      name: "Create",
      exact: true,
    });

    this.editExistingTagButton = (tagName: string) =>
      page.getByRole("row", { name: tagName }).getByRole("button").nth(0);
    this.deleteExistingTagButton = (tagName: string) =>
      page.getByRole("row", { name: tagName }).getByRole("button").nth(1);
  }
}
