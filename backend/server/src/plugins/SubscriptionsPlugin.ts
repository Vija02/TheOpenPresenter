import { Build } from "graphile-build";
import { QueryBuilder, SQL } from "graphile-build-pg";
import {
  embed /*, AugmentedGraphQLFieldResolver */,
  gql,
  makeExtendSchemaPlugin,
} from "graphile-utils";
// graphile-utils doesn't export this yet
import { GraphQLResolveInfo } from "graphql";

import { OurGraphQLContext } from "../graphile.config";
type GraphileHelpers = any;
type AugmentedGraphQLFieldResolver<
  TSource,
  TContext,
  TArgs = { [argName: string]: any }
> = (
  parent: TSource,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo & {
    graphile: GraphileHelpers;
  }
) => any;

/*
 * PG NOTIFY events are sent via a channel, this function helps us determine
 * which channel to listen to for the currently logged in user by extracting
 * their `user_id` from the GraphQL context.
 *
 * NOTE: channels are limited to 63 characters in length (this is a PostgreSQL
 * limitation).
 */
const currentUserTopicFromContext = async (
  _args: {},
  context: { [key: string]: any },
  _resolveInfo: GraphQLResolveInfo
) => {
  let userId: number | null = null;
  if (context.sessionId /* fail fast */) {
    // We have the users session ID, but to get their actual ID we need to ask the database.
    const {
      rows: [user],
    } = await context.pgClient.query(
      "select app_public.current_user_id() as id"
    );
    userId = user?.id;
  }
  if (userId) {
    return `graphql:user:${userId}`;
  } else {
    throw new Error("You're not logged in");
  }
};

/*
 * Resolves the per-row PG NOTIFY channel for a single screen.
 */
const screenTopicFromArgs = async (
  args: { screenId: string },
  context: { [key: string]: any },
  _resolveInfo: GraphQLResolveInfo
) => {
  const {
    rows: [row],
  } = await context.pgClient.query(
    "select app_public.current_user_can_access_screen($1::uuid) as allowed",
    [args.screenId]
  );
  if (!row?.allowed) {
    throw new Error("You do not have access to this screen");
  }
  return `graphql:screens:${args.screenId}`;
};

/*
 * Per-row PG NOTIFY channel for a screen_control_request
 */
const screenControlRequestTopicFromArgs = async (
  args: { requestId: string },
  context: { [key: string]: any },
  _resolveInfo: GraphQLResolveInfo
) => {
  const {
    rows: [row],
  } = await context.pgClient.query(
    `
      select exists(
        select 1
        from app_public.screen_control_requests r
        join app_public.screens s on s.id = r.screen_id
        where r.id = $1
          and (
            r.screen_guest_session_id = app_public.current_screen_guest_session_id()
            or s.organization_id in (select app_public.current_user_member_organization_ids())
          )
      ) as allowed
    `,
    [args.requestId]
  );
  if (!row?.allowed) {
    throw new Error("You do not have access to this control request");
  }
  return `graphql:scr_req:${args.requestId}`;
};

/*
 * Per-row PG NOTIFY channel for the active controller of a screen
 */
const screenActiveControllerTopicFromArgs = async (
  args: { screenId: string },
  context: { [key: string]: any },
  _resolveInfo: GraphQLResolveInfo
) => {
  const {
    rows: [row],
  } = await context.pgClient.query(
    "select app_public.current_user_can_access_screen($1::uuid) as allowed",
    [args.screenId]
  );
  if (!row?.allowed) {
    const {
      rows: [seat],
    } = await context.pgClient.query(
      `
        select 1
        from app_public.screen_active_controllers ac
        where ac.screen_id = $1
          and ac.screen_guest_session_id = app_public.current_screen_guest_session_id()
      `,
      [args.screenId]
    );
    if (!seat) {
      throw new Error("You do not have access to this screen's controller");
    }
  }
  return `graphql:scr_ctl:${args.screenId}`;
};

/*
 * This plugin adds a number of custom subscriptions to our schema. By making
 * sure our subscriptions are tightly focussed we can ensure that our schema
 * remains scalable and that developers do not get overwhelmed with too many
 * subscription options being open. You can also use external sources of realtime
 * data when PostgreSQL's LISTEN/NOTIFY is not sufficient.
 *
 * Read more about this in the PostGraphile documentation:
 *
 * https://www.graphile.org/postgraphile/subscriptions/#custom-subscriptions
 *
 * And see the database trigger function `app_public.tg__graphql_subscription()`.
 */
const SubscriptionsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
       type UserSubscriptionPayload {
        user: User # Populated by our resolver below
        event: String # Part of the NOTIFY payload
      }

      type ScreenSubscriptionPayload {
        screen: Screen # Populated by our resolver below
        event: String # Part of the NOTIFY payload
      }

      type ScreenControlRequestSubscriptionPayload {
        request: ScreenControlRequest
        event: String
      }

      type ScreenActiveControllerSubscriptionPayload {
        activeController: ScreenActiveController
        event: String
      }

      extend type Subscription {
        """
        Triggered when the logged in user's record is updated in some way.
        """
        currentUserUpdated: UserSubscriptionPayload @pgSubscription(topic: ${embed(
          currentUserTopicFromContext
        )})

        """
        Triggered when the screen is updated in some way.
        """
        screenUpdated(screenId: UUID!): ScreenSubscriptionPayload @pgSubscription(topic: ${embed(
          screenTopicFromArgs
        )})

        """
        Triggered when a control request changes status.
        """
        screenControlRequestUpdated(
          requestId: UUID!
        ): ScreenControlRequestSubscriptionPayload @pgSubscription(topic: ${embed(
          screenControlRequestTopicFromArgs
        )})

        """
        Triggered when the active controller for a screen changes.
        """
        screenActiveControllerUpdated(
          screenId: UUID!
        ): ScreenActiveControllerSubscriptionPayload @pgSubscription(topic: ${embed(
          screenActiveControllerTopicFromArgs
        )})
      }
    `,
    resolvers: {
      UserSubscriptionPayload: {
        user: recordByIdFromTable(build, sql.fragment`app_public.users`),
      },
      ScreenSubscriptionPayload: {
        screen: recordByIdFromTable(build, sql.fragment`app_public.screens`),
      },
      ScreenControlRequestSubscriptionPayload: {
        request: recordByIdFromTable(
          build,
          sql.fragment`app_public.screen_control_requests`
        ),
      },
      ScreenActiveControllerSubscriptionPayload: {
        activeController: recordByIdFromTable(
          build,
          sql.fragment`app_public.screen_active_controllers`,
          "screen_id"
        ),
      },
    },
  };
});

/* The JSON object that `tg__graphql_subscription()` delivers via NOTIFY */
interface TgGraphQLSubscriptionPayload {
  event: string;
  subject: string | null;
}

/*
 * This function handles the boilerplate of fetching a record from the database
 * which has the 'id' equal to the 'subject' from the PG NOTIFY event payload
 * (see `tg__graphql_subscription()` trigger function in the database).
 */

function recordByIdFromTable(
  build: Build,
  sqlTable: SQL,
  idColumn: string = "id"
): AugmentedGraphQLFieldResolver<TgGraphQLSubscriptionPayload, any> {
  const { pgSql: sql } = build;
  return async (
    event: TgGraphQLSubscriptionPayload,
    _args: {},
    _context: OurGraphQLContext,
    { graphile: { selectGraphQLResultFromTable } }
  ) => {
    const rows = await selectGraphQLResultFromTable(
      sqlTable,
      (tableAlias: SQL, sqlBuilder: QueryBuilder) => {
        sqlBuilder.where(
          sql.fragment`${tableAlias}.${sql.identifier(idColumn)} = ${sql.value(
            event.subject
          )}`
        );
      }
    );
    return rows[0];
  };
}

export default SubscriptionsPlugin;
