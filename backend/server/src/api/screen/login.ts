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
      organizationId: UUID!
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
              (organization_id, kind, display_name)
            values ($1, 'anon', $2)
            returning id
          `,
          [organizationId, displayName ?? null],
        );

        // Store on the cookie so subsequent requests authenticate as this guest.
        if (req.session) {
          req.session.screenGuestSession = {
            id: created.id,
            organizationId,
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
        const { organizationId, passcode } = args.input;

        const {
          rows: [allowedRow],
        } = await rootPgPool.query(
          `
            select exists(
              select 1 from app_public.screens
              where organization_id = $1
                and registered_guest_enabled = true
            ) as allowed
          `,
          [organizationId],
        );
        if (!allowedRow?.allowed) {
          throw new Error(
            "This organization has no screens accepting registered guests",
          );
        }
        const {
          rows: [created],
        } = await rootPgPool.query(
          `select id from app_private.authenticate_screen_guest($1, $2)`,
          [organizationId, passcode],
        );

        // Store on the cookie so subsequent requests authenticate as this guest.
        if (req.session) {
          req.session.screenGuestSession = {
            id: created.id,
            organizationId,
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
