import { type Locator, type Page } from "@playwright/test";

export class SetupScreenDevicePage {
  readonly heading: Locator;
  readonly qrAuthUrl: Locator;

  constructor(public readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Setup this screen" });
    this.qrAuthUrl = page.getByTestId("qrlogin-auth-url");
  }

  async goto() {
    await this.page.goto("/setup");
  }

  async getAuthUrl(): Promise<string> {
    await this.qrAuthUrl.waitFor({ state: "attached" });
    const url = await this.qrAuthUrl.textContent();
    if (!url) {
      throw new Error("qrlogin-auth-url element was empty");
    }
    return url.trim();
  }
}
