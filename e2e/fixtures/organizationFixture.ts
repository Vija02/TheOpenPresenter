import { OrganizationPage } from "../pages/OrganizationPage";
import { test as base } from "./baseFixture";

type OrganizationFixture = {
  organizationPage: OrganizationPage;
};

export const test = base.extend<OrganizationFixture>({
  organizationPage: async ({ page }, use) => {
    const organizationPage = new OrganizationPage(page);
    await use(organizationPage);
  },
});

export { expect } from "@playwright/test";
