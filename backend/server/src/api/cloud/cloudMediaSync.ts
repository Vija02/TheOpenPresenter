import { cloud, media } from "@repo/backend-shared";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import { withPgClientFromPool } from "../../utils/withPgClientFromPool";

/**
 * Serves media to connected local instances. The files themselves move
 * through `/media/data` and the tus endpoint.
 */
export const cloudMediaSync = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Query {
      cloudMediaSyncPage(organizationSlug: String!, after: UUID): JSON!
    }

    extend type Mutation {
      cloudMediaSyncPush(
        organizationSlug: String!
        metadata: JSON!
        links: JSON!
      ): JSON!
      cloudMediaSyncDelete(organizationSlug: String!, mediaIds: JSON!): JSON!
    }
  `,
  resolvers: {
    Query: {
      async cloudMediaSyncPage(
        _query: unknown,
        args: { organizationSlug: string; after?: string | null },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        return cloud.listCloudMediaPage(
          context.pgClient,
          organizationId,
          args.after ?? null,
        );
      },
    },
    Mutation: {
      async cloudMediaSyncPush(
        _mutation: unknown,
        args: {
          organizationSlug: string;
          metadata: cloud.MediaMetadata;
          links: cloud.LinkChange[];
        },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        const metadata = await cloud.applyPushedMediaMetadata(
          context.pgClient,
          context.rootPgPool,
          organizationId,
          { ...cloud.emptyMediaMetadata(), ...args.metadata },
        );
        const links = await cloud.applyPushedLinks(
          context.pgClient,
          organizationId,
          args.links ?? [],
        );
        return { metadata, links };
      },
      async cloudMediaSyncDelete(
        _mutation: unknown,
        args: { organizationSlug: string; mediaIds: string[] },
        context: OurGraphQLContext,
      ) {
        const organizationId = await cloud.findCloudOrganizationId(
          context.pgClient,
          args.organizationSlug,
        );
        const handler = new media[
          process.env.STORAGE_TYPE as "file" | "s3"
        ].mediaHandler(withPgClientFromPool(context.rootPgPool));
        return cloud.deleteSyncedMedia(
          context.pgClient,
          context.rootPgPool,
          organizationId,
          args.mediaIds ?? [],
          (mediaName) => handler.deleteMedia(mediaName),
        );
      },
    },
  },
}));
