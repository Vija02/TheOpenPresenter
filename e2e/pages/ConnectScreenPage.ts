import { type Locator, type Page } from "@playwright/test";

export class ConnectScreenPage {
  readonly heading: Locator;
  readonly codeInput: Locator;
  readonly submitButton: Locator;
  readonly fieldError: Locator;

  constructor(public readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Connect to a screen" });
    this.codeInput = page.getByTestId("connectpage-input-code");
    this.submitButton = page.getByRole("button", { name: "Connect" });
    // react-hook-form renders a FormMessage <p> next to the input
    this.fieldError = page.getByText("No screen found with that code");
  }

  async goto() {
    await this.page.goto("/connect");
  }

  async enterCode(code: string) {
    await this.codeInput.focus();
    await this.page.keyboard.type(code);
  }
}
