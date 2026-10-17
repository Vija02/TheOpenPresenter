import { cloud } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";

/** Serves the organization's own settings to connected local instances. */
export const cloudOrganizationSync = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      cloudOrganizationSyncGet(organizationSlug: String!): JSON!
    }

    extend type Mutation {
      cloudOrganizationSyncPush(
        organizationSlug: String!
        expected: JSON!
        value: JSON!
      ): JSON!
    }
  `,
  resolvers: {
    Query: {
      async cloudOrganizationSyncGet(
        _query: unknown,
        args: { organizationSlug: string },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        return cloud.getCloudOrganizationSyncValue(
          context.pgClient,
          organizationId,
        );
      },
    },
    Mutation: {
      async cloudOrganizationSyncPush(
        _mutation: unknown,
        args: {
          organizationSlug: string;
          expected: cloud.OrganizationSyncValue;
          value: cloud.OrganizationSyncValue;
        },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        return cloud.applyPushedOrganizationChange(
          context.pgClient,
          organizationId,
          { expected: args.expected, value: args.value },
        );
      },
    },
  },
}));
