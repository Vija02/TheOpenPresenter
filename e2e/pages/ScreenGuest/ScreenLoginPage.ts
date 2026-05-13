import { type Locator, type Page } from "@playwright/test";

export class ScreenLoginPage {
  readonly heading: Locator;
  readonly anonTab: Locator;
  readonly passcodeTab: Locator;
  readonly form: Locator;
  readonly displayNameInput: Locator;
  readonly passcodeInput: Locator;
  readonly continueButton: Locator;
  readonly signInButton: Locator;
  readonly signOutGuestButton: Locator;
  readonly errorAlert: Locator;
  readonly screenNotAvailableAlert: Locator;

  constructor(public readonly page: Page) {
    this.heading = page.getByRole("heading", {
      name: "Sign in to control a screen",
    });
    this.form = page.locator("div").filter({ has: this.heading }).last();
    this.anonTab = page.getByRole("tab", { name: "Continue as guest" });
    this.passcodeTab = page.getByRole("tab", { name: "I have a passcode" });
    this.displayNameInput = page.getByPlaceholder("Your name (optional)");
    this.passcodeInput = page.getByPlaceholder("Email or passcode");
    this.continueButton = this.form.getByRole("button", { name: "Continue" });
    this.signInButton = this.form.getByRole("button", {
      name: "Sign in",
      exact: true,
    });
    this.signOutGuestButton = page.getByRole("button", {
      name: "Sign out of guest session",
    });
    this.errorAlert = page.getByRole("alert").filter({ hasText: "Error" });
    this.screenNotAvailableAlert = page.getByText("Screen not available");
  }

  async goto(orgSlug: string, screenSlug: string) {
    await this.page.goto(`/o/${orgSlug}/screens/${screenSlug}/login`);
  }

  async continueAsGuest(name?: string) {
    if (await this.anonTab.isVisible().catch(() => false)) {
      await this.anonTab.click();
    }
    if (name) {
      await this.displayNameInput.fill(name);
    }
    await this.continueButton.click();
  }

  async signInWithCredential(credential: string) {
    if (await this.passcodeTab.isVisible().catch(() => false)) {
      await this.passcodeTab.click();
    }
    await this.passcodeInput.fill(credential);
    await this.signInButton.click();
  }
}
