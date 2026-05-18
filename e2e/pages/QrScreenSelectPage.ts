import { type Locator, type Page } from "@playwright/test";

export class QrScreenSelectPage {
  readonly heading: Locator;
  readonly missingIdAlert: Locator;
  readonly noScreensMessage: Locator;

  constructor(public readonly page: Page) {
    this.heading = this.page.getByRole("heading", { name: "Pick a screen" });
    this.missingIdAlert = this.page.getByText("Missing id");
    this.noScreensMessage = this.page.getByText(
      "You don't have access to any screens.",
    );
  }

  screenOption(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }
}
