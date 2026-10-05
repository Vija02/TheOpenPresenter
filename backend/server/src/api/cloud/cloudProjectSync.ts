import { cloud } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";

/** Serves project metadata to connected local instances. */
export const cloudProjectSync = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      cloudProjectSyncList(organizationSlug: String!): JSON!
    }

    extend type Mutation {
      cloudProjectSyncPush(organizationSlug: String!, changes: JSON!): JSON!
    }
  `,
  resolvers: {
    Query: {
      async cloudProjectSyncList(
        _query: unknown,
        args: { organizationSlug: string },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        return cloud.listCloudProjects(context.pgClient, organizationId);
      },
    },
    Mutation: {
      async cloudProjectSyncPush(
        _mutation: unknown,
        args: { organizationSlug: string; changes: cloud.ProjectPushChange[] },
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
        );
      },
    },
  },
}));
