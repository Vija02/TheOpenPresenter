import { ORG_SLUG, orgUrl, tagged } from "../helpers/workerData";
import { CloudPage } from "../pages/CloudPage";
import { test as base } from "./projectFixture";

export const SYNC_ORG_SLUG = tagged("testsyncorg");

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
    const fn = async (next: string = orgUrl()) => {
      await e2eCommand.login({
        verified: true,
        orgs: [
          {
            name: "TestOrg",
            slug: ORG_SLUG,
            projects: [{ name: "TestProject", slug: "testproject" }],
          },
          {
            name: "TestSyncOrg",
            slug: SYNC_ORG_SLUG,
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
