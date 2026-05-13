import { type Locator, type Page, expect } from "@playwright/test";

export class ScreenAdminPage {
  readonly backToScreensLink: Locator;
  readonly screenHeading: Locator;
  readonly setupButton: Locator;

  readonly pendingPanel: Locator;
  readonly pendingPanelHeading: Locator;
  readonly approveButton: Locator;
  readonly denyButton: Locator;

  readonly endGuestSessionButton: Locator;

  readonly advancedSettingsHeading: Locator;
  readonly dangerZoneHeading: Locator;

  readonly deleteScreenButton: Locator;
  readonly confirmDeleteButton: Locator;

  constructor(public readonly page: Page) {
    this.backToScreensLink = page.getByRole("link", {
      name: "Back to screens",
    });
    this.screenHeading = page.getByRole("heading", { level: 1 });
    this.setupButton = page.getByRole("button", { name: "Setup" });

    this.pendingPanelHeading = page.getByRole("heading", {
      name: /Pending screen control requests/,
    });
    this.pendingPanel = page
      .locator("div")
      .filter({ has: this.pendingPanelHeading })
      .last();

    this.approveButton = page.getByRole("button", { name: "Approve" });
    this.denyButton = page.getByRole("button", { name: "Deny" });

    this.endGuestSessionButton = page.getByRole("button", {
      name: "End guest session",
    });

    this.advancedSettingsHeading = page.getByRole("heading", {
      name: "Advanced settings",
    });
    this.dangerZoneHeading = page.getByRole("heading", { name: "Danger zone" });

    this.deleteScreenButton = page.getByRole("button", {
      name: "Delete screen",
    });
    // PopConfirm confirmation button — distinct from the trigger above.
    this.confirmDeleteButton = page.getByRole("button", {
      name: "Delete",
      exact: true,
    });
  }

  async goto(orgSlug: string, screenSlug: string) {
    await this.page.goto(`/o/${orgSlug}/screens/${screenSlug}/admin`);
  }

  pendingRequestRow(displayName: string): Locator {
    return this.pendingPanel
      .locator("div")
      .filter({ has: this.page.getByText(displayName, { exact: true }) })
      .filter({ has: this.page.getByRole("button", { name: "Approve" }) })
      .last();
  }

  approveButtonFor(displayName: string): Locator {
    return this.pendingRequestRow(displayName).getByRole("button", {
      name: "Approve",
    });
  }

  denyButtonFor(displayName: string): Locator {
    return this.pendingRequestRow(displayName).getByRole("button", {
      name: "Deny",
    });
  }

  autoApproveCountdownFor(displayName: string): Locator {
    return this.pendingRequestRow(displayName).getByText(
      /Auto-approves in|Auto-approving/,
    );
  }

  async pendingRequestCount(): Promise<number> {
    if (!(await this.pendingPanelHeading.isVisible())) return 0;
    const text = (await this.pendingPanelHeading.textContent()) ?? "";
    const match = text.match(/\((\d+)\)/);
    return match ? Number(match[1]) : 0;
  }

  async deleteScreen() {
    await this.deleteScreenButton.click();
    await expect(this.confirmDeleteButton).toBeVisible();
    await this.confirmDeleteButton.click();
  }
}
