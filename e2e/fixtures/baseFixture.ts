import { test as base } from "@playwright/test";

import { E2ECommandAPI } from "../e2eCommand";

export type BaseFixture = {
  e2eCommand: E2ECommandAPI;
  loginDefault: (next?: string) => void;
  loginWithDefaultProject: (next?: string) => void;
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
});

export { expect } from "@playwright/test";
