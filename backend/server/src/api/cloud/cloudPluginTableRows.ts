import { cloud } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";

type TableArgs = {
  organizationSlug: string;
  schemaName: string;
  tableName: string;
};

const resolveTarget = async (context: OurGraphQLContext, args: TableArgs) => {
  const { tables } = await cloud.introspectCloudSyncTables(context.pgClient);
  const table = tables.find(
    (t) => t.schema === args.schemaName && t.table === args.tableName,
  );
  if (!table) {
    throw new Error("Table is not available for sync");
  }
  const organizationId = await cloud.findCloudOrganizationId(
    context.pgClient,
    args.organizationSlug,
  );
  return { table, organizationId };
};

/** Serves `@cloudSync` plugin tables to connected local instances. */
export const cloudPluginTableRows = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      cloudPluginTableKeys(
        organizationSlug: String!
        schemaName: String!
        tableName: String!
      ): JSON!
      cloudPluginTableRows(
        organizationSlug: String!
        schemaName: String!
        tableName: String!
        keys: JSON!
      ): JSON!
    }

    extend type Mutation {
      cloudPluginTablePush(
        organizationSlug: String!
        schemaName: String!
        tableName: String!
        changes: JSON!
      ): JSON!
    }
  `,
  resolvers: {
    Query: {
      async cloudPluginTableKeys(
        _query: unknown,
        args: TableArgs,
        context: OurGraphQLContext,
      ) {
        const { table, organizationId } = await resolveTarget(context, args);
        return cloud.listCloudRowKeys(context.pgClient, table, organizationId);
      },

      async cloudPluginTableRows(
        _query: unknown,
        args: TableArgs & { keys: unknown[] },
        context: OurGraphQLContext,
      ) {
        const { table, organizationId } = await resolveTarget(context, args);
        return cloud.listCloudRows(
          context.pgClient,
          table,
          organizationId,
          args.keys ?? [],
        );
      },
    },
    Mutation: {
      async cloudPluginTablePush(
        _mutation: unknown,
        args: TableArgs & { changes: cloud.PushChange[] },
        context: OurGraphQLContext,
      ) {
        const { table, organizationId } = await resolveTarget(context, args);
        const {
          rows: [{ user_id }],
        } = await context.pgClient.query(
          "select app_public.current_user_id() as user_id",
        );
        return cloud.applyPushedChanges(
          context.pgClient,
          table,
          organizationId,
          user_id,
          args.changes ?? [],
        );
      },
    },
  },
}));
