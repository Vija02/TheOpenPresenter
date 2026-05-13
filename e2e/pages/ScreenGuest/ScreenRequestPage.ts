import { type Locator, type Page } from "@playwright/test";

export class ScreenRequestPage {
  readonly heading: Locator;
  readonly requestControlButton: Locator;
  readonly claimingControlAlert: Locator;
  readonly waitingForApprovalAlert: Locator;
  readonly waitingForControllerAlert: Locator;
  readonly requestDeniedError: Locator;
  readonly couldNotClaimAlert: Locator;

  constructor(public readonly page: Page) {
    this.heading = page.getByRole("heading", { name: "Request control" });
    this.requestControlButton = page.getByRole("button", {
      name: "Request control",
    });
    this.claimingControlAlert = page.getByText(/Claiming control/i);
    this.waitingForApprovalAlert = page.getByText(/Waiting for approval/i);
    this.waitingForControllerAlert = page.getByText(
      /Waiting for the current controller/i,
    );
    this.requestDeniedError = page.getByText("Your request was denied.");
    this.couldNotClaimAlert = page.getByText("Couldn't claim control");
  }

  async goto(orgSlug: string, screenSlug: string) {
    await this.page.goto(`/o/${orgSlug}/screens/${screenSlug}/request`);
  }
}
