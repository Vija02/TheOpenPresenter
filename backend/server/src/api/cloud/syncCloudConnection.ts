import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

export const syncCloudConnection = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    input SyncCloudConnectionInput {
      cloudConnectionId: UUID!
    }

    type SyncCloudConnectionPayload {
      success: Boolean!
    }

    extend type Mutation {
      """
      Use this mutation to sync a cloud connection
      """
      syncCloudConnection(
        input: SyncCloudConnectionInput!
      ): SyncCloudConnectionPayload
    }
  `,
  resolvers: {
    Mutation: {
      async syncCloudConnection(_mutation, args, context: OurGraphQLContext) {
        const { cloudConnectionId } = args.input;
        const { pgClient, rootPgPool } = context;

        await pgClient.query("SAVEPOINT graphql_mutation");

        const {
          rows: [cloudConnection],
        } = await pgClient.query(
          `select * from app_public.cloud_connections where id = $1`,
          [cloudConnectionId],
        );

        if (!cloudConnection) {
          throw new Error("No permission to sync this cloud connection");
        }

        try {
          await rootPgPool.query(
            `
              select graphile_worker.add_job(
                'cloud_connection__sync',
                json_build_object(
                  'id', $1::uuid
                )
              );
            `,
            [cloudConnectionId],
          );

          return { success: true };
        } catch (e: any) {
          await pgClient.query("ROLLBACK TO SAVEPOINT graphql_mutation");

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
            throw Object.assign(new Error("Failed to resync connection"), {
              code,
            });
          }
        } finally {
          await pgClient.query("RELEASE SAVEPOINT graphql_mutation");
        }
      },
    },
  },
}));
