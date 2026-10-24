import { BrowserContext, Page } from "@playwright/test";

import { orgUrl, projectUrl, tagged, taggedUser } from "../helpers/workerData";
import { HostProjectsPage } from "../pages/HostProjectsPage";
import { test as base } from "./baseFixture";

export const HOST_ORG = tagged("testhostorg");
export const VIEWER_ORG = tagged("testviewerorg");
const HOST_USER = taggedUser("testuser_host");
const VIEWER_USER = taggedUser("testuser_viewer");

type HostProjectsFixture = {
  hostProjectsPage: HostProjectsPage;

  setupHostProjectsEnvironment: () => Promise<{
    hostContext: BrowserContext;
    hostPage: Page;
  }>;

  startMockHostDevice: () => Promise<{
    irohEndpointId: string;
    irohTicket: string;
  }>;
  stopMockHostDevice: () => Promise<void>;
  syncMockHostDevice: () => Promise<void>;
  clearAllActiveDevices: () => Promise<void>;
};

export const test = base.extend<HostProjectsFixture>({
  hostProjectsPage: async ({ page }, use) => {
    const hostProjectsPage = new HostProjectsPage(page);
    await use(hostProjectsPage);
  },

  setupHostProjectsEnvironment: async ({ browser, e2eCommand }, use) => {
    const state: {
      hostContext?: BrowserContext;
      hostPage?: Page;
    } = {};

    const fn = async () => {
      await e2eCommand.login({
        username: HOST_USER,
        name: "Test Host User",
        verified: true,
        orgs: [
          {
            name: "TestHostOrg",
            slug: HOST_ORG,
            projects: [
              { name: "HostProject1", slug: "hostproject1" },
              { name: "HostProject2", slug: "hostproject2" },
            ],
          },
        ],
        next: "/",
      });

      await e2eCommand.login({
        username: VIEWER_USER,
        name: "Test Viewer User",
        verified: true,
        orgs: [
          {
            name: "TestViewerOrg",
            slug: VIEWER_ORG,
            projects: [],
          },
        ],
        next: orgUrl(VIEWER_ORG),
      });

      await e2eCommand.serverCommand("createCloudConnection", {
        organizationSlug: HOST_ORG,
        targetOrganizationSlug: VIEWER_ORG,
      });

      // Start the mock host device
      await e2eCommand.serverCommand("startMockHostDevice");

      // Open a project to make it active
      // Use a SEPARATE browser context to avoid sharing cookies with viewer
      state.hostContext = await browser.newContext();
      state.hostPage = await state.hostContext.newPage();

      // Login as host user in the separate context
      const hostProjectUrl = projectUrl(HOST_ORG, "hostproject1");
      await state.hostPage.goto(
        `/E2EServerCommand?command=login&payload=${encodeURIComponent(
          JSON.stringify({
            username: HOST_USER,
            verified: true,
            next: hostProjectUrl,
          }),
        )}`,
      );
      await state.hostPage.waitForLoadState("networkidle");

      // Add a plugin so the project has some content
      // Otherwise, the document won't be registered

      await state.hostPage
        .getByText("Timer", { exact: true })
        .click({ force: true });

      return {
        hostContext: state.hostContext,
        hostPage: state.hostPage,
      };
    };

    await use(fn);

    // Cleanup
    if (state.hostPage) {
      await state.hostPage.close().catch(() => {});
    }
    if (state.hostContext) {
      await state.hostContext.close().catch(() => {});
    }
  },
  startMockHostDevice: async ({ e2eCommand }, use) => {
    const fn = async () => {
      const result = await e2eCommand.serverCommand("startMockHostDevice");
      return {
        irohEndpointId: result.irohEndpointId,
        irohTicket: result.irohTicket,
      };
    };

    await use(fn);
  },
  stopMockHostDevice: async ({ e2eCommand }, use) => {
    const fn = async () => {
      await e2eCommand.serverCommand("stopMockHostDevice");
    };

    await use(fn);
  },
  syncMockHostDevice: async ({ e2eCommand }, use) => {
    const fn = async () => {
      await e2eCommand.serverCommand("syncMockHostDevice");
    };

    await use(fn);
  },
  clearAllActiveDevices: async ({ e2eCommand }, use) => {
    const fn = async () => {
      await e2eCommand.serverCommand("clearAllActiveDevices");
    };

    await use(fn);
  },
});

export { expect } from "@playwright/test";
