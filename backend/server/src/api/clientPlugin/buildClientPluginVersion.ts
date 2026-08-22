import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { buildAndPersistVersion } from "../../clientPlugins/persist";
import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

export const buildClientPluginVersion = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Builds a client plugin version's authored source into runtime bundles and
      stores the artifacts.
      """
      buildClientPluginVersion(
        input: BuildClientPluginVersionInput!
      ): BuildClientPluginVersionPayload
    }

    input BuildClientPluginVersionInput {
      versionId: UUID!
    }

    type BuildClientPluginVersionPayload {
      success: Boolean!
      buildLog: String!
    }
  `,
  resolvers: {
    Mutation: {
      async buildClientPluginVersion(
        _mutation,
        args,
        context: OurGraphQLContext,
      ) {
        const { versionId } = args.input;
        const { pgClient, rootPgPool } = context;

        const {
          rows: [version],
        } = await pgClient.query(
          `select v.id
             from app_public.client_plugin_versions v
             join app_public.client_plugins p on p.id = v.client_plugin_id
            where v.id = $1
              and p.owner_organization_id in (
                select app_public.current_user_member_organization_ids()
              )`,
          [versionId],
        );

        if (!version) {
          throw new Error("Version not found");
        }

        try {
          const result = await buildAndPersistVersion(rootPgPool, versionId);
          return {
            success: result.ok,
            buildLog: result.ok
              ? `Built ${result.fileCount} file(s)`
              : result.log,
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
              "Unrecognised error in buildClientPluginVersion; sanitizing",
            );
            console.error(e);
            throw Object.assign(
              new Error("Failed to build client plugin version"),
              { code },
            );
          }
        }
      },
    },
  },
}));
