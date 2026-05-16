import { KeyPressType, keyPressTypes } from "@repo/base-plugin";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../graphile.config";
import { dispatchKeyPress } from "./keyPressDispatch";

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
      sceneId: String
    }

    type PluginKeyPressPayload {
      success: Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async pluginKeyPress(_mutation, args, context: OurGraphQLContext) {
        const {
          keyType,
          projectId,
          rendererId,
          sceneId: inputSceneId,
        } = args.input;
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

        if (!projectRow) {
          throw new Error("Project not found");
        }

        const result = dispatchKeyPress({
          keyType: keyType as KeyPressType,
          projectId,
          rendererId,
          sceneId: inputSceneId,
          organizationId: projectRow.organization_id,
        });

        if (!result.success) {
          return null;
        }
        return { success: true };
      },
    },
  },
}));
