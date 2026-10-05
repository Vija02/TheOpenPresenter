import { cloud } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";

const { quoteIdent, rowKeySql } = cloud;

const findTable = async (
  context: OurGraphQLContext,
  schemaName: string,
  tableName: string,
) => {
  const { tables } = await cloud.introspectCloudSyncTables(context.pgClient);
  const table = tables.find(
    (t) => t.schema === schemaName && t.table === tableName,
  );
  if (!table) {
    throw new Error("Table is not available for sync");
  }
  return table;
};

/** Serves `@cloudSync` plugin tables */
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
  `,
  resolvers: {
    Query: {
      async cloudPluginTableKeys(
        _query: unknown,
        args: {
          organizationSlug: string;
          schemaName: string;
          tableName: string;
        },
        context: OurGraphQLContext,
      ) {
        const table = await findTable(context, args.schemaName, args.tableName);
        const {
          rows: [row],
        } = await context.pgClient.query(
          `
            select coalesce(jsonb_agg(jsonb_build_object(
              'key', ${rowKeySql(table, "t")},
              'updatedAt', t.updated_at
            )), '[]'::jsonb) as keys
            from ${quoteIdent(table.schema)}.${quoteIdent(table.table)} t
            where t.${quoteIdent(table.organizationColumn)} = (
              select id from app_public.organizations where slug = $1
            )
          `,
          [args.organizationSlug],
        );
        return row.keys;
      },

      async cloudPluginTableRows(
        _query: unknown,
        args: {
          organizationSlug: string;
          schemaName: string;
          tableName: string;
          keys: unknown[];
        },
        context: OurGraphQLContext,
      ) {
        const table = await findTable(context, args.schemaName, args.tableName);
        const {
          rows: [row],
        } = await context.pgClient.query(
          `
            select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as rows
            from ${quoteIdent(table.schema)}.${quoteIdent(table.table)} t
            where t.${quoteIdent(table.organizationColumn)} = (
                select id from app_public.organizations where slug = $1
              )
              and ${rowKeySql(table, "t")} in (
                select jsonb_array_elements($2::jsonb)
              )
          `,
          [args.organizationSlug, JSON.stringify(args.keys ?? [])],
        );
        return row.rows;
      },
    },
  },
}));
