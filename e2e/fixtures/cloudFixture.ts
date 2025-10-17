import { CloudPage } from "../pages/CloudPage";
import { test as base } from "./projectFixture";

type CloudFixture = {
  cloudPage: CloudPage;
  loginWithCloudProjects: (next?: string) => void;
};

export const test = base.extend<CloudFixture>({
  cloudPage: async ({ page }, use) => {
    const cloudPage = new CloudPage(page);
    await use(cloudPage);
  },
  loginWithCloudProjects: async ({ e2eCommand }, use) => {
    const fn = async (next: string = "/o/testorg") => {
      await e2eCommand.login({
        verified: true,
        orgs: [
          {
            name: "TestOrg",
            slug: "testorg",
            projects: [{ name: "TestProject", slug: "testproject" }],
          },
          {
            name: "TestSyncOrg",
            slug: "testsyncorg",
            projects: [
              { name: "SyncProject", slug: "testsyncproject" },
              { name: "SyncProject2", slug: "testsyncproject2" },
            ],
          },
        ],
        next,
      });
    };

    await use(fn);
  },
});

export { expect } from "@playwright/test";
