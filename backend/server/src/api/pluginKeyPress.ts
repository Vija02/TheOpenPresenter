import { Server } from "@hocuspocus/server";
import {
  Scene,
  State,
  YState,
  createTraverser,
  keyPressTypes,
} from "@repo/base-plugin";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";
import { Doc } from "yjs";

import { OurGraphQLContext } from "../graphile.config";
import { serverPluginApi } from "../pluginManager";
import { ERROR_MESSAGE_OVERRIDES } from "../utils/handleErrors";

export const pluginKeyPress = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Use this mutation to trigger a key press
      """
      pluginKeyPress(input: PluginKeyPressInput!): PluginKeyPressPayload
    }

    input PluginKeyPressInput {
      keyType: String!
      projectId: String!
      rendererId: String!
    }

    type PluginKeyPressPayload {
      success: Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async pluginKeyPress(_mutation, args, context: OurGraphQLContext) {
        const { keyType, projectId, rendererId } = args.input;
        const { pgClient } = context;

        if (!keyPressTypes.includes(keyType)) {
          throw new Error("Invalid keyType");
        }

        const {
          rows: [projectRow],
        } = await pgClient.query(
          `
            select id, organization_id from app_public.projects where id = $1
          `,
          [projectId],
        );

        // Validate that the user can do this
        if (!projectRow || !Server.documents.has(projectId)) {
          throw new Error("Project not found");
        }

        // TODO: Validate rendererId

        try {
          const document = Server.documents.get(projectId);
          const state = document?.getMap() as YState;

          const traverser = createTraverser<State>(state);

          const sceneId = traverser(
            (x) => x.renderer[rendererId]?.currentScene!,
          );
          const renderer = traverser(
            (x) => x.renderer[rendererId]?.children[sceneId]!,
          );

          for (const pluginId of renderer.keys()) {
            const children = traverser(
              (x) => (x.data[sceneId] as Scene).children,
            );
            const plugin = children.get(pluginId);
            const pluginName = plugin?.get("plugin");
            const handler = serverPluginApi
              .getRegisteredKeyPressHandler()
              .find((x) => x.pluginName === pluginName);

            try {
              handler?.callback(
                keyType,
                {
                  document: document as Doc,
                  pluginData: plugin?.get("pluginData"),
                  rendererData: renderer.get(pluginId),
                  pluginContext: {
                    pluginId,
                    sceneId,
                    organizationId: projectRow.organization_id,
                  },
                },
                () => {
                  // TODO: Handle next
                },
              );
            } catch (e) {
              // TODO:
              console.error(e);
              throw new Error("Plugin crash");
            }
          }

          return { success: true };
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
            throw Object.assign(
              new Error("Failed to invoke plugin key press"),
              {
                code,
              },
            );
          }
        }
      },
    },
  },
}));
