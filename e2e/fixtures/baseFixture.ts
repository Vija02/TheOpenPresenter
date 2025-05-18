import { test as base } from "@playwright/test";

import { E2ECommandAPI } from "../e2eCommand";

export type BaseFixture = {
  e2eCommand: E2ECommandAPI;
};

export const test = base.extend<BaseFixture>({
  e2eCommand: async ({ page, request }, use) => {
    const e2eCommandApi = new E2ECommandAPI(page, request);
    await use(e2eCommandApi);
  },
});

export { expect } from "@playwright/test";
