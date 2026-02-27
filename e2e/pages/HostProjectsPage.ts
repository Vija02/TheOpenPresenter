import { type Locator, type Page } from "@playwright/test";

export class HostProjectsPage {
  readonly page: Page;
  readonly hostProjectsHeading: Locator;
  readonly hostProjectCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.hostProjectsHeading = page.getByRole("heading", {
      name: "Host Projects",
    });
    this.hostProjectCards = page.locator(".project--project-card");
  }

  getHostProjectCardByName(projectName: string): Locator {
    return this.page
      .locator(".project--project-card")
      .filter({ hasText: projectName });
  }

  getHostProjectLink(projectName: string): Locator {
    return this.getHostProjectCardByName(projectName).locator(
      ".project--project-card-main-link",
    );
  }

  getHostProjectPresentButton(projectName: string): Locator {
    return this.getHostProjectCardByName(projectName).getByRole("button");
  }

  async clickHostProject(projectName: string): Promise<void> {
    await this.getHostProjectLink(projectName).click();
  }

  async clickHostProjectPresent(projectName: string): Promise<Page> {
    const popupPromise = this.page.context().waitForEvent("page");
    await this.getHostProjectPresentButton(projectName).click();
    return popupPromise;
  }
}
