import { media } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

export const deleteUserMedia = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Use this mutation to delete a media
      """
      deleteUserMedia(input: DeleteUserMediaInput!): DeleteUserMediaPayload
    }

    input DeleteUserMediaInput {
      id: UUID!
    }

    type DeleteUserMediaPayload {
      success: Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async deleteUserMedia(_mutation, args, context: OurGraphQLContext) {
        const { id } = args.input;
        const { pgClient, rootPgPool } = context;

        const {
          rows: [mediaRow],
        } = await pgClient.query(
          `
            select id, media_name from app_public.medias where id = $1
          `,
          [id],
        );

        // Validate that the user can do this. If they can see it, they can do action to it
        if (!mediaRow) {
          throw new Error("Media not found");
        }

        try {
          await new media[
            process.env.STORAGE_TYPE as "file" | "s3"
          ].mediaHandler(rootPgPool).deleteMedia(mediaRow.media_name);

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
            throw Object.assign(new Error("Failed to delete media"), {
              code,
            });
          }
        }
      },
    },
  },
}));
