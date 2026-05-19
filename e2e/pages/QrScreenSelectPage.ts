import { type Locator, type Page } from "@playwright/test";

export class QrScreenSelectPage {
  readonly heading: Locator;
  readonly missingIdAlert: Locator;
  /** Shown when the user has no organizations at all. */
  readonly noAccessMessage: Locator;
  /** Shown in both single-org and multi-org empty states. */
  readonly noScreensYetMessage: Locator;
  /** The primary "Create screen" button in the single-org empty state. */
  readonly createScreenButton: Locator;
  /** "Your organizations" heading in the multi-org empty state. */
  readonly yourOrganizationsHeading: Locator;

  // Create-screen modal locators
  readonly newScreenDialog: Locator;
  readonly newScreenNameInput: Locator;
  readonly newScreenSlugInput: Locator;
  readonly newScreenSubmitButton: Locator;

  constructor(public readonly page: Page) {
    this.heading = this.page.getByRole("heading", {
      name: "Connect this TV",
    });
    this.missingIdAlert = this.page.getByText("Missing id");
    this.noAccessMessage = this.page.getByText(
      "You don't have access to any organizations with screens.",
    );
    this.noScreensYetMessage = this.page.getByText("No screens yet");
    this.createScreenButton = this.page.getByRole("button", {
      name: "Create screen",
      exact: true,
    });
    this.yourOrganizationsHeading = this.page.getByRole("heading", {
      name: "Your organizations",
    });

    this.newScreenDialog = this.page.getByRole("dialog");
    this.newScreenNameInput = this.newScreenDialog.getByLabel("Name");
    this.newScreenSlugInput = this.newScreenDialog.getByLabel("Slug");
    this.newScreenSubmitButton = this.newScreenDialog.getByRole("button", {
      name: "Create",
      exact: true,
    });
  }

  /** A screen row inside any org section. */
  screenOption(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }

  /** The org section heading that groups screens for a given org. */
  orgSectionHeading(orgName: string): Locator {
    return this.page.getByRole("heading", { name: orgName });
  }

  /**
   * The "Create new screen" row at the bottom of a given org's screen list
   * in the populated state.
   */
  createNewScreenRow(orgName: string): Locator {
    return this.page
      .locator("section")
      .filter({ has: this.orgSectionHeading(orgName) })
      .getByRole("button", { name: "Create new screen" });
  }

  /**
   * The clickable org row inside the multi-org "No screens yet" empty state.
   */
  orgEmptyStateRow(orgName: string): Locator {
    return this.page.getByRole("button", {
      name: new RegExp(`${orgName}.*Create a new screen`, "s"),
    });
  }

  async fillNewScreenForm(name: string, slug?: string) {
    await this.newScreenNameInput.fill(name);
    if (slug !== undefined) {
      await this.newScreenSlugInput.fill(slug);
    }
  }
}
