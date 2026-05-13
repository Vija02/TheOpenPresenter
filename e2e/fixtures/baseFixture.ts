import { type BrowserContext, type Page, test as base } from "@playwright/test";

import { E2ECommandAPI } from "../e2eCommand";

type OrgOwnerContextOptions = {
  orgSlug: string;
  orgName: string;
  username?: string;
  next?: string;
};

export type OrgOwnerContext = {
  page: Page;
  api: E2ECommandAPI;
};

export type BaseFixture = {
  e2eCommand: E2ECommandAPI;
  loginDefault: (next?: string) => void;
  loginWithDefaultProject: (next?: string) => void;
  /**
   * Spins up a second browser context signed in as the org owner
   */
  setupOrgOwnerContext: (
    options: OrgOwnerContextOptions,
  ) => Promise<OrgOwnerContext>;
};

export const test = base.extend<BaseFixture>({
  e2eCommand: async ({ page, request }, use) => {
    const e2eCommandApi = new E2ECommandAPI(page, request);
    await use(e2eCommandApi);
  },
  loginDefault: async ({ e2eCommand }, use) => {
    const fn = async (next: string = "/o/testorg") => {
      await e2eCommand.login({
        orgs: [{ name: "TestOrg", slug: "testorg" }],
        next,
      });
    };

    await use(fn);
  },
  loginWithDefaultProject: async ({ e2eCommand }, use) => {
    const fn = async (next: string = "/o/testorg") => {
      await e2eCommand.login({
        orgs: [
          {
            name: "TestOrg",
            slug: "testorg",
            projects: [{ name: "TestProject", slug: "testproject" }],
          },
        ],
        next,
      });
    };

    await use(fn);
  },
  setupOrgOwnerContext: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    const fn = async ({
      orgSlug,
      orgName,
      username,
      next = "/",
    }: OrgOwnerContextOptions): Promise<OrgOwnerContext> => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      const api = new E2ECommandAPI(page, context.request);
      await api.login({
        username,
        orgs: [{ name: orgName, slug: orgSlug, owner: true }],
        next,
      });
      return { page, api };
    };

    await use(fn);

    await Promise.all(contexts.map((c) => c.close().catch(() => {})));
  },
});

export { expect } from "@playwright/test";
