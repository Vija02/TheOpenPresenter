import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { buildClientPlugin } from "../../clientPlugins/build";
import { runtimePluginName } from "../../clientPlugins/naming";
import { OurGraphQLContext } from "../../graphile.config";
import { ERROR_MESSAGE_OVERRIDES } from "../../utils/handleErrors";

// Dry-run compile for testing
export const testBuildClientPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Compiles client plugin source without persisting anything, so authors can
      check a build before publishing a version.
      """
      testBuildClientPlugin(
        input: TestBuildClientPluginInput!
      ): TestBuildClientPluginPayload
    }

    input TestBuildClientPluginInput {
      clientPluginId: UUID!
      """
      JSON: map of filename -> source, as shown in the editor.
      """
      source: JSON!
    }

    type TestBuildClientPluginPayload {
      success: Boolean!
      buildLog: String!
      """
      Filenames the build would have produced, on success.
      """
      artifacts: [String!]!
    }
  `,
  resolvers: {
    Mutation: {
      async testBuildClientPlugin(_mutation, args, context: OurGraphQLContext) {
        const { clientPluginId, source } = args.input;
        const { pgClient } = context;

        const {
          rows: [plugin],
        } = await pgClient.query(
          `select id
             from app_public.client_plugins
            where id = $1
              and owner_organization_id in (
                select app_public.current_user_member_organization_ids()
              )`,
          [clientPluginId],
        );

        if (!plugin) {
          throw new Error("Plugin not found");
        }

        if (!source || typeof source !== "object" || Array.isArray(source)) {
          throw new Error("Invalid source");
        }

        try {
          // No version id yet, so use a stable placeholder purely for CSS
          // scoping/tag naming during the dry run.
          const runtimeName = runtimePluginName(clientPluginId, "preview");
          const result = await buildClientPlugin(
            runtimeName,
            source as Record<string, string>,
          );

          return {
            success: result.ok,
            buildLog: result.log,
            artifacts: result.ok ? result.files.map((f) => f.filename) : [],
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
          }
          console.error("Unrecognised error in testBuildClientPlugin");
          console.error(e);
          throw Object.assign(new Error("Failed to test build"), { code });
        }
      },
    },
  },
}));
