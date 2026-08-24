import { ClientPluginApi, uniqueSlug } from "../helpers/clientPluginApi";
import { PluginsAdminPage } from "../pages/PluginsAdminPage";
import { ProjectPage } from "../pages/ProjectPage";
import { test as base } from "./baseFixture";

/**
 * Gives each client plugin test its own organization, a project to add scenes
 * to, the plugins admin UI and an API client for bootstrapping.
 *
 * The org must be unique: the E2E login command CREATES the org, so a shared
 * slug collides with a leftover row from an earlier run, the insert fails, and
 * the browser is left silently unauthenticated. That failure surfaces later as
 * a confusing "no organization for slug" from the first query.
 *
 * It must also be torn down. `pluginMeta` is resolved WITHOUT an organization
 * id by the remote, so every enabled plugin of every org lands in the scene
 * picker: leaving orgs behind makes each run slower than the last until the
 * picker is thousands of entries deep and these tests time out. The slug is
 * prefixed "test" so `clearTestOrganizations` can sweep anything a crashed run
 * left behind.
 */

export const PROJECT_SLUG = "testproject";

export type ClientPluginFixture = {
  cplugin: {
    api: ClientPluginApi;
    organizationId: string;
    orgSlug: string;
    /** Creates a plugin owned by this test's org and returns its id. */
    createPlugin: (label: string, title?: string) => Promise<string>;
    /**
     * Bootstraps a published, installed plugin over the API. The UI specs use
     * this when the authoring flow is not what they are testing.
     */
    seedPlugin: (input: {
      label: string;
      title: string;
      version?: string;
      source: Record<string, string>;
    }) => Promise<{ pluginId: string; versionId: string }>;
    /** Opens the "Add component" panel without picking anything. */
    openScenePicker: () => Promise<void>;
    /** Opens the panel and adds a scene from the named plugin. */
    addScene: (title: string) => Promise<void>;
    gotoProject: () => Promise<void>;
  };
  pluginsAdmin: PluginsAdminPage;
  projectPage: ProjectPage;
};

export const test = base.extend<ClientPluginFixture>({
  pluginsAdmin: async ({ page }, use, testInfo) => {
    testInfo.setTimeout(PluginsAdminPage.SPEC_TIMEOUT);
    await use(new PluginsAdminPage(page));
  },
  projectPage: async ({ page, context }, use) => {
    await use(new ProjectPage(page, context));
  },
  cplugin: async ({ page, context, e2eCommand }, use) => {
    // "test" prefix so clearTestOrganizations can sweep leftovers.
    const orgSlug = uniqueSlug("testcplugin");

    await e2eCommand.login({
      orgs: [
        {
          name: `CPlugin ${orgSlug}`,
          slug: orgSlug,
          owner: true,
          projects: [{ name: "TestProject", slug: PROJECT_SLUG }],
        },
      ],
      next: `/o/${orgSlug}`,
    });

    const api = new ClientPluginApi(page.request);
    const organizationId = await api.organizationId(orgSlug);

    const createPlugin = (label: string, title?: string) =>
      api.createPlugin({
        ownerOrganizationId: organizationId,
        handle: uniqueSlug(label),
        title: title ?? `E2E ${label}`,
      });

    const seedPlugin = async (input: {
      label: string;
      title: string;
      version?: string;
      source: Record<string, string>;
    }) => {
      const pluginId = await createPlugin(input.label, input.title);
      const versionId = await api.publish({
        clientPluginId: pluginId,
        version: input.version ?? "1.0.0",
        source: input.source,
      });
      await api.ensureInstalled({
        organizationId,
        clientPluginId: pluginId,
        enabled: true,
      });
      return { pluginId, versionId };
    };

    const gotoProject = async () => {
      await page.goto(`/app/${orgSlug}/${PROJECT_SLUG}`);
    };

    const scenePicker = new ProjectPage(page, context);

    const openScenePicker = async () => {
      await page.getByTestId("add-scene").click({ force: true });
    };

    const addScene = async (title: string) => {
      await openScenePicker();
      // Both the mobile and desktop pickers are mounted, so the card matches
      // twice. A generous wait: pluginMeta has to come back and the plugin's
      // bundle has to register before the card exists.
      const option = scenePicker.sceneCreatorOption(title).first();
      await option.waitFor({ timeout: 60_000 });
      await option.click({ force: true });
    };

    await use({
      api,
      organizationId,
      orgSlug,
      createPlugin,
      seedPlugin,
      openScenePicker,
      addScene,
      gotoProject,
    });

    // Teardown, not just hygiene: an org left installed keeps feeding its
    // plugins into every later test's scene picker.
    await e2eCommand.serverCommand("clearOrganizationBySlug", {
      slug: orgSlug,
    });
  },
});

export { expect } from "@playwright/test";
