import { logger } from "@repo/observability";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";
import { Pool } from "pg";

import { OurGraphQLContext } from "../../graphile.config";

/**
 * For live sync unto studio.
 * Sends hints when something changes.
 */

// Well inside the 90 seconds a presence counts for.
const PRESENCE_REFRESH_MS = 30_000;

type PubSub = { asyncIterator<T>(topic: string): AsyncIterator<T> };

const memberOrganizationId = async (
  context: OurGraphQLContext,
  organizationSlug: string,
) => {
  const {
    rows: [organization],
  } = await context.pgClient.query<{ id: string }>(
    `select id from app_public.organizations
     where slug = $1
       and id in (select app_public.current_user_member_organization_ids())`,
    [organizationSlug],
  );
  if (!organization) {
    throw new Error("You do not have access to this organization");
  }
  return organization.id;
};

export const withPresence = async <T>(
  rootPgPool: Pool,
  organizationId: string,
  listen: () => AsyncIterator<T>,
): Promise<AsyncIterableIterator<T>> => {
  const {
    rows: [presence],
  } = await rootPgPool.query<{ id: string }>(
    `insert into app_private.cloud_sync_presence (organization_id)
     values ($1) returning id`,
    [organizationId],
  );
  const { id } = presence!;
  const events = listen();
  const refresh = setInterval(() => {
    rootPgPool
      .query(
        `update app_private.cloud_sync_presence set seen_at = now()
         where id = $1`,
        [id],
      )
      .catch((err) => logger.warn({ err }, "Failed to refresh presence"));
  }, PRESENCE_REFRESH_MS);

  let ended = false;
  const end = async () => {
    if (ended) return;
    ended = true;
    clearInterval(refresh);
    await rootPgPool
      .query(`delete from app_private.cloud_sync_presence where id = $1`, [id])
      .catch((err) => logger.warn({ err }, "Failed to clear presence"));
  };

  const iterator: AsyncIterableIterator<T> = {
    next: () => events.next(),
    // The socket closed or the studio unsubscribed.
    return: async (value?: unknown) => {
      await end();
      return events.return?.(value) ?? { done: true, value: undefined };
    },
    throw: async (err?: unknown) => {
      await end();
      if (events.throw) return events.throw(err);
      throw err;
    },
    [Symbol.asyncIterator]: () => iterator,
  };
  return iterator;
};

export const cloudLiveSync = makeExtendSchemaPlugin((_build, options) => {
  const pubsub = (options as { pubsub?: PubSub }).pubsub;
  return {
    typeDefs: gql`
      type CloudSyncHint {
        """
        The table that changed, e.g. app_public.projects
        """
        entity: String
        """
        The cloud connection id of the studio whose sync made the change, if any
        """
        origin: String
      }

      extend type Subscription {
        """
        Triggered when something cloud sync covers changes in the organization.
        """
        cloudOrganizationChanged(organizationSlug: String!): CloudSyncHint
      }
    `,
    resolvers: {
      Subscription: {
        cloudOrganizationChanged: {
          subscribe: async (
            _parent: unknown,
            args: { organizationSlug: string },
            context: OurGraphQLContext,
          ) => {
            if (!pubsub) throw new Error("Subscriptions are not enabled");
            const organizationId = await memberOrganizationId(
              context,
              args.organizationSlug,
            );
            return withPresence(
              context.rootPgPool,
              organizationId,
              () => pubsub.asyncIterator(`cloud_sync:${organizationId}`),
            );
          },
          resolve: (hint: unknown) => hint,
        },
      },
    },
  };
});
