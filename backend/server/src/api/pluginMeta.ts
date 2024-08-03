import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../graphile.config";
import { serverPluginApi } from "../pluginManager";
import { ERROR_MESSAGE_OVERRIDES } from "../utils/handleErrors";

export const pluginMeta = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      pluginMeta: PluginMeta!
    }

    type PluginMeta {
      sceneCreator: [SceneCreator!]!
      registeredView: [RegisteredView!]!
    }

    type SceneCreator {
      pluginName: String!
      title: String!
    }

    type RegisteredView {
      pluginName: String!
      tag: String!
    }
  `,
  resolvers: {
    Query: {
      async pluginMeta(_, _args, _context: OurGraphQLContext) {
        try {
          const sceneCreator = serverPluginApi.getRegisteredSceneCreator();
          const remoteViewWebComponent =
            serverPluginApi.getRegisteredRemoteViewWebComponent();

          return {
            sceneCreator: sceneCreator.map((x) => ({
              pluginName: x.pluginName,
              title: x.sceneCreatorMeta.title,
            })),
            registeredView: remoteViewWebComponent.map((x) => ({
              pluginName: x.pluginName,
              tag: x.webComponentTag,
            })),
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
