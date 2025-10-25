import { type Locator, type Page } from "@playwright/test";

export class CloudPage {
  readonly hostInput: Locator;
  readonly connectToCloudButton: Locator;
  readonly selectOrgButton: (slug: string) => Locator;
  readonly startSyncButton: Locator;

  constructor(public readonly page: Page) {
    this.hostInput = page.locator("[data-testid=host-input]");
    this.connectToCloudButton = page.getByRole("button", {
      name: "Connect to Cloud",
    });
    this.selectOrgButton = (slug: string) =>
      page.locator(`[data-testid=select-org-${slug}]`);
    this.startSyncButton = page.getByRole("button", { name: "Start Sync" });
  }
}
