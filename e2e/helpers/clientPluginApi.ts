import type { APIRequestContext } from "@playwright/test";

/**
 * Drives the real client plugin GraphQL API: create, publish, install, pin,
 * enable/disable. Used by the cplugin e2e specs so they exercise the same
 * mutations the plugin editor UI calls rather than seeding the database.
 */

const GRAPHQL_URL = "/graphql";

export type GraphqlError = { message: string };

/**
 * A slug unique per test run. The login command creates the org, so a shared
 * slug makes a leftover row from an earlier run fail the insert and silently
 * leave the browser unauthenticated.
 */
export const uniqueSlug = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

const post = async (
  request: APIRequestContext,
  query: string,
  variables: Record<string, unknown>,
) => {
  const res = await request.post(GRAPHQL_URL, {
    headers: { "x-top-csrf-protection": "1" },
    data: { query, variables },
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(
      `graphql failed: ${body.errors.map((e: GraphqlError) => e.message).join("; ")}`,
    );
  }
  return body.data;
};

export class ClientPluginApi {
  constructor(public readonly request: APIRequestContext) {}

  /** The org's uuid, which every install mutation needs. */
  async organizationId(slug: string): Promise<string> {
    const data = await post(
      this.request,
      `query ($slug: String!) {
         organizationBySlug(slug: $slug) { id }
       }`,
      { slug },
    );
    const id = data?.organizationBySlug?.id;
    if (!id) throw new Error(`no organization for slug "${slug}"`);
    return id;
  }

  async createPlugin(input: {
    ownerOrganizationId: string;
    handle: string;
    title: string;
  }): Promise<string> {
    const data = await post(
      this.request,
      `mutation ($input: CreateClientPluginInput!) {
         createClientPlugin(input: $input) { clientPlugin { id } }
       }`,
      { input: { clientPlugin: input } },
    );
    return data.createClientPlugin.clientPlugin.id;
  }

  /** Creates a version row carrying the authored source. */
  async createVersion(input: {
    clientPluginId: string;
    version: string;
    source: Record<string, string>;
  }): Promise<string> {
    const data = await post(
      this.request,
      `mutation ($input: CreateClientPluginVersionInput!) {
         createClientPluginVersion(input: $input) {
           clientPluginVersion { id buildStatus }
         }
       }`,
      {
        input: {
          clientPluginVersion: {
            clientPluginId: input.clientPluginId,
            version: input.version,
            source: input.source,
          },
        },
      },
    );
    return data.createClientPluginVersion.clientPluginVersion.id;
  }

  /** Compiles the version's source into runtime bundles. */
  async build(versionId: string): Promise<{
    success: boolean;
    buildLog: string;
  }> {
    const data = await post(
      this.request,
      `mutation ($input: BuildClientPluginVersionInput!) {
         buildClientPluginVersion(input: $input) { success buildLog }
       }`,
      { input: { versionId } },
    );
    return data.buildClientPluginVersion;
  }

  /** create + build in one step, since a version is useless unbuilt. */
  async publish(input: {
    clientPluginId: string;
    version: string;
    source: Record<string, string>;
  }): Promise<string> {
    const versionId = await this.createVersion(input);
    const result = await this.build(versionId);
    if (!result.success) {
      throw new Error(`build failed for ${input.version}: ${result.buildLog}`);
    }
    return versionId;
  }

  /**
   * Installs into an org.
   *
   * A successful build already auto-installs the plugin for its OWNER org (see
   * the _300_autoinstall_for_owner trigger), so calling this for the owner after
   * publishing conflicts. Use `ensureInstalled` unless you specifically want the
   * insert.
   */
  async install(input: {
    organizationId: string;
    clientPluginId: string;
    pinnedVersionId?: string | null;
  }) {
    return post(
      this.request,
      `mutation ($input: CreateOrganizationClientPluginInput!) {
         createOrganizationClientPlugin(input: $input) {
           organizationClientPlugin { enabled pinnedVersionId }
         }
       }`,
      {
        input: {
          organizationClientPlugin: {
            organizationId: input.organizationId,
            clientPluginId: input.clientPluginId,
            pinnedVersionId: input.pinnedVersionId ?? null,
          },
        },
      },
    );
  }

  /** Installs, or updates the existing (auto-created) install row. */
  async ensureInstalled(input: {
    organizationId: string;
    clientPluginId: string;
    pinnedVersionId?: string | null;
    enabled?: boolean;
  }) {
    const patch: { pinnedVersionId?: string | null; enabled?: boolean } = {};
    if (input.pinnedVersionId !== undefined) {
      patch.pinnedVersionId = input.pinnedVersionId;
    }
    if (input.enabled !== undefined) patch.enabled = input.enabled;

    const existing = await this.findInstall(
      input.organizationId,
      input.clientPluginId,
    );
    if (existing) {
      if (Object.keys(patch).length === 0) return existing;
      return this.updateInstall({
        organizationId: input.organizationId,
        clientPluginId: input.clientPluginId,
        patch,
      });
    }
    return this.install(input);
  }

  /** The install row, or null when the org has not installed the plugin. */
  async findInstall(organizationId: string, clientPluginId: string) {
    const data = await post(
      this.request,
      `query ($organizationId: UUID!, $clientPluginId: UUID!) {
         organizationClientPlugin(
           organizationId: $organizationId
           clientPluginId: $clientPluginId
         ) { enabled pinnedVersionId }
       }`,
      { organizationId, clientPluginId },
    );
    return data.organizationClientPlugin ?? null;
  }

  /** Flips enabled, or moves the org's pin. */
  async updateInstall(input: {
    organizationId: string;
    clientPluginId: string;
    patch: { enabled?: boolean; pinnedVersionId?: string | null };
  }) {
    return post(
      this.request,
      `mutation ($input: UpdateOrganizationClientPluginInput!) {
         updateOrganizationClientPlugin(input: $input) {
           organizationClientPlugin { enabled pinnedVersionId }
         }
       }`,
      {
        input: {
          organizationId: input.organizationId,
          clientPluginId: input.clientPluginId,
          patch: input.patch,
        },
      },
    );
  }

  /** The artifacts the remote actually loads, straight from pluginMeta. */
  async views(): Promise<
    {
      pluginName: string;
      pluginFamily: string;
      versionId: string;
      isInstallDefault: boolean;
      remoteTag: string;
      remoteCss: string[];
      initialPluginData: Record<string, unknown>;
      initialRendererData: Record<string, unknown>;
    }[]
  > {
    const data = await post(
      this.request,
      `query {
         pluginMeta {
           clientPluginViews {
             pluginName
             pluginFamily
             versionId
             isInstallDefault
             remoteTag
             remoteCss
             initialPluginData
             initialRendererData
           }
         }
       }`,
      {},
    );
    return data.pluginMeta.clientPluginViews;
  }
}
