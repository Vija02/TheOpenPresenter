import { cloud } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";

/** Serves project metadata to connected local instances. */
export const cloudProjectSync = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      cloudProjectSyncList(organizationSlug: String!, version: Int): JSON!
    }

    extend type Mutation {
      cloudProjectSyncPush(
        organizationSlug: String!
        changes: JSON!
        version: Int
      ): JSON!
    }
  `,
  resolvers: {
    Query: {
      async cloudProjectSyncList(
        _query: unknown,
        args: { organizationSlug: string; version?: number | null },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        return cloud.listCloudProjects(
          context.pgClient,
          organizationId,
          cloud.projectSyncVersion(args.version),
        );
      },
    },
    Mutation: {
      async cloudProjectSyncPush(
        _mutation: unknown,
        args: {
          organizationSlug: string;
          changes: cloud.ProjectPushChange[];
          version?: number | null;
        },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        const {
          rows: [{ user_id }],
        } = await context.pgClient.query(
          "select app_public.current_user_id() as user_id",
        );
        return cloud.applyPushedProjectChanges(
          context.pgClient,
          organizationId,
          user_id,
          args.changes ?? [],
          cloud.projectSyncVersion(args.version),
        );
      },
    },
  },
}));
