import { media } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

export const unlinkMediaFromPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Use this mutation to unlink a media from a plugin. The media will stay in the user's library unless it is marked as a system media.
      System media will be deleted once there is no more reference to it.
      """
      unlinkMediaFromPlugin(
        input: UnlinkMediaFromPluginInput!
      ): UnlinkMediaFromPluginPayload
    }

    input UnlinkMediaFromPluginInput {
      pluginId: UUID!
      projectId: UUID
      mediaUUID: UUID
    }

    type UnlinkMediaFromPluginPayload {
      success: Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async unlinkMediaFromPlugin(_mutation, args, context: OurGraphQLContext) {
        const { pluginId, projectId, mediaUUID } = args.input;
        const { rootPgPool } = context;

        try {
          await new media[
            process.env.STORAGE_TYPE as "file" | "s3"
          ].mediaHandler(rootPgPool).unlinkPlugin(pluginId, {
            projectId,
            mediaIdOrUUID: mediaUUID,
          });

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
              new Error("Failed to unlink media from plugin"),
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
