import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { resolveClientPluginsForOrg } from "../clientPlugins/resolveForOrg";
import { OurGraphQLContext } from "../graphile.config";
import { serverPluginApi } from "../pluginManager";
import { ERROR_MESSAGE_OVERRIDES } from "../utils/handleErrors";

export const pluginMeta = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      pluginMeta(organizationId: UUID): PluginMeta!
    }

    type PluginMeta {
      sceneCreator: [SceneCreator!]!
      registeredRemoteView: [RegisteredRemoteView!]!
      registeredRendererView: [RegisteredRendererView!]!
      registeredDerivationFields: [RegisteredDerivationFields!]!
      registeredDataBindings: [RegisteredDataBindings!]!
      clientPluginViews: [ClientPluginView!]!
    }

    type RegisteredDerivationFields {
      pluginName: String!
      fields: JSON!
    }

    type RegisteredDataBindings {
      pluginName: String!
      bindings: JSON!
    }

    type SceneCreator {
      pluginName: String!
      title: String!
      description: String!
      categories: [String!]!
      icon: String
      organizationTypes: [OrganizationType!]
      isExperimental: Boolean
      isStarred: Boolean
    }

    type RegisteredRemoteView {
      pluginName: String!
      tag: String!
      config: RemoteViewWebComponentConfig
    }

    type RemoteViewWebComponentConfig {
      alwaysRender: Boolean
    }

    type RegisteredRendererView {
      pluginName: String!
      tag: String!
    }

    """
    A client-side plugin enabled for the requesting organization.
    Carries everything the frontend runtime needs to load and register it.
    """
    type ClientPluginView {
      pluginName: String!
      pluginFamily: String!
      versionId: UUID!
      isInstallDefault: Boolean!
      remoteTag: String!
      remoteScripts: [String!]!
      remoteCss: [String!]!
      rendererTag: String!
      rendererScripts: [String!]!
      rendererCss: [String!]!
      title: String!
      description: String!
      initialPluginData: JSON!
      initialRendererData: JSON!
    }
  `,
  resolvers: {
    Query: {
      async pluginMeta(_, args, context: OurGraphQLContext) {
        try {
          const sceneCreator = serverPluginApi.getRegisteredSceneCreator();
          const remoteViewWebComponent =
            serverPluginApi.getRegisteredRemoteViewWebComponent();
          const rendererViewWebComponent =
            serverPluginApi.getRegisteredRendererViewWebComponent();

          let clientPluginViews: any[] = [];
          {
            const resolved = await resolveClientPluginsForOrg(
              context.pgClient,
              args.organizationId ?? null,
            );
            clientPluginViews = resolved.map((x) => ({
              pluginName: x.pluginName,
              pluginFamily: x.pluginFamily,
              versionId: x.versionId,
              isInstallDefault: x.isInstallDefault,
              remoteTag: x.remote.tag,
              remoteScripts: x.remote.scripts,
              remoteCss: x.remote.css,
              rendererTag: x.renderer.tag,
              rendererScripts: x.renderer.scripts,
              rendererCss: x.renderer.css,
              title: x.title,
              description: x.description,
              initialPluginData: x.manifest.pluginData,
              initialRendererData: x.manifest.rendererData,
            }));
          }

          return {
            sceneCreator: sceneCreator.map((x) => ({
              pluginName: x.pluginName,
              title: x.sceneCreatorMeta.title,
              description: x.sceneCreatorMeta.description,
              categories: x.sceneCreatorMeta.categories,
              icon: x.sceneCreatorMeta.icon ?? null,
              organizationTypes:
                x.sceneCreatorMeta.organizationTypeWhitelist?.map((x) =>
                  x.toLowerCase(),
                ) ?? null,
              isExperimental: x.sceneCreatorMeta.isExperimental,
              isStarred: x.sceneCreatorMeta.isStarred,
            })),
            registeredRemoteView: remoteViewWebComponent.map((x) => ({
              pluginName: x.pluginName,
              tag: x.webComponentTag,
              config: { alwaysRender: x.config?.alwaysRender },
            })),
            registeredRendererView: rendererViewWebComponent.map((x) => ({
              pluginName: x.pluginName,
              tag: x.webComponentTag,
            })),
            registeredDerivationFields: serverPluginApi
              .getRegisteredDerivationFields()
              .map((x) => ({
                pluginName: x.pluginName,
                fields: x.fields,
              })),
            registeredDataBindings: serverPluginApi
              .getRegisteredDataBindings()
              .map((x) => ({
                pluginName: x.pluginName,
                bindings: x.bindings,
              })),
            clientPluginViews,
          };
        } catch (e: any) {
          const { code } = e;
          const safeErrorCodes = [
            "WEAKP",
            "LOCKD",
            "EMTKN",
            ...Object.keys(ERROR_MESSAGE_OVERRIDES),
          ];
          if (safeErrorCodes.includes(code)) {
            throw e;
          } else {
            console.error(
              "Unrecognised error in APIPlugin; replacing with sanitized version",
            );
            console.error(e);
            throw Object.assign(new Error("Failed to include plugin meta"), {
              code,
            });
          }
        }
      },
    },
  },
}));
