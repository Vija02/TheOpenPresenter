import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";

const screenLoginPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Create a new anonymous guest session for the given organization
      """
      createAnonScreenGuestSession(
        input: CreateAnonScreenGuestSessionInput!
      ): CreateAnonScreenGuestSessionPayload

      """
      Verify a registered-guest entry
      """
      authenticateScreenGuest(
        input: AuthenticateScreenGuestInput!
      ): AuthenticateScreenGuestPayload

      """
      End the current guest session
      """
      logoutScreenGuestSession: LogoutScreenGuestSessionPayload
    }

    input CreateAnonScreenGuestSessionInput {
      """
      The screen the visitor is signing in for
      """
      screenId: UUID!
      displayName: String
    }
    type CreateAnonScreenGuestSessionPayload {
      success: Boolean!
    }

    input AuthenticateScreenGuestInput {
      screenId: UUID!
      """
      Email or passcode
      """
      passcode: String!
    }
    type AuthenticateScreenGuestPayload {
      success: Boolean!
    }

    type LogoutScreenGuestSessionPayload {
      success: Boolean!
    }
  `,
  resolvers: {
    Mutation: {
      async createAnonScreenGuestSession(
        _mutation,
        args,
        context: OurGraphQLContext,
      ) {
        const { rootPgPool, req } = context;
        const { screenId, displayName } = args.input;

        const {
          rows: [screenRow],
        } = await rootPgPool.query(
          `
            select organization_id
            from app_public.screens
            where id = $1
              and anon_guest_enabled = true
          `,
          [screenId],
        );
        if (!screenRow) {
          throw new Error("This screen doesn't accept anonymous guests");
        }
        const organizationId = screenRow.organization_id;

        const {
          rows: [created],
        } = await rootPgPool.query(
          `
            insert into app_public.screen_guest_sessions
              (screen_id, organization_id, kind, display_name)
            values ($1, $2, 'anon', $3)
            returning id
          `,
          [screenId, organizationId, displayName ?? null],
        );

        // Store on the cookie so subsequent requests authenticate as this guest.
        if (req.session) {
          req.session.screenGuestSession = {
            id: created.id,
            organizationId,
            screenId,
          };
        }

        return { success: true };
      },

      async authenticateScreenGuest(
        _mutation,
        args,
        context: OurGraphQLContext,
      ) {
        const { rootPgPool, req } = context;
        const { screenId, passcode } = args.input;

        const {
          rows: [screenRow],
        } = await rootPgPool.query(
          `
            select organization_id, registered_guest_enabled
            from app_public.screens
            where id = $1
          `,
          [screenId],
        );
        if (!screenRow) {
          throw new Error("Screen not found");
        }
        if (!screenRow.registered_guest_enabled) {
          throw new Error("This screen does not accept registered guests");
        }

        const {
          rows: [created],
        } = await rootPgPool.query(
          `select id from app_private.authenticate_screen_guest($1, $2)`,
          [screenId, passcode],
        );

        // Store on the cookie so subsequent requests authenticate as this guest.
        if (req.session) {
          req.session.screenGuestSession = {
            id: created.id,
            organizationId: screenRow.organization_id,
            screenId,
          };
        }

        return { success: true };
      },

      async logoutScreenGuestSession(
        _mutation,
        _args,
        context: OurGraphQLContext,
      ) {
        const { rootPgPool, req } = context;
        const sessionId = req?.session?.screenGuestSession?.id;

        if (sessionId) {
          await rootPgPool.query(
            `delete from app_public.screen_guest_sessions where id = $1`,
            [sessionId],
          );
        }

        if (req?.session) {
          (req.session as any).screenGuestSession = undefined;
        }

        return { success: !!sessionId };
      },
    },
  },
}));

export default screenLoginPlugin;
