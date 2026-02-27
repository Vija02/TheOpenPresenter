import { BrowserContext, Page } from "@playwright/test";

import { HostProjectsPage } from "../pages/HostProjectsPage";
import { test as base } from "./baseFixture";

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
        username: "testuser_host",
        name: "Test Host User",
        verified: true,
        orgs: [
          {
            name: "TestHostOrg",
            slug: "testhostorg",
            projects: [
              { name: "HostProject1", slug: "hostproject1" },
              { name: "HostProject2", slug: "hostproject2" },
            ],
          },
        ],
        next: "/",
      });

      await e2eCommand.login({
        username: "testuser_viewer",
        name: "Test Viewer User",
        verified: true,
        orgs: [
          {
            name: "TestViewerOrg",
            slug: "testviewerorg",
            projects: [],
          },
        ],
        next: "/o/testviewerorg",
      });

      await e2eCommand.serverCommand("createCloudConnection", {
        organizationSlug: "testhostorg",
        targetOrganizationSlug: "testviewerorg",
      });

      // Start the mock host device
      await e2eCommand.serverCommand("startMockHostDevice");

      // Open a project to make it active
      // Use a SEPARATE browser context to avoid sharing cookies with viewer
      state.hostContext = await browser.newContext();
      state.hostPage = await state.hostContext.newPage();

      // Login as host user in the separate context
      const hostProjectUrl = "/app/testhostorg/hostproject1";
      await state.hostPage.goto(
        `/E2EServerCommand?command=login&payload=${encodeURIComponent(
          JSON.stringify({
            username: "testuser_host",
            verified: true,
            next: hostProjectUrl,
          }),
        )}`,
      );
      await state.hostPage.waitForLoadState("networkidle");

      // Add a plugin so the project has some content
      // Otherwise, the document won't be registered
      await state.hostPage
        .getByRole("button", { name: "Add New Scene" })
        .click();
      await state.hostPage
        .getByLabel("Add scene")
        .getByText("Timer", { exact: true })
        .click();
      await state.hostPage.getByRole("button", { name: "Add Scene" }).click();

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
