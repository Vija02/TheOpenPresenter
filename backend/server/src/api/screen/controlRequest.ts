import { gql, makeExtendSchemaPlugin } from "graphile-utils";

import { OurGraphQLContext } from "../../graphile.config";
import {
  ScreenControlResultIdentifiers,
  ScreenGuestSessionKind,
  isMemberOfOrg,
  resolveActiveController,
  resolveRequest,
  resolveScreenControlPolicy,
} from "./helpers";

const screenControlRequestPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    extend type Mutation {
      """
      Ask to control a screen as the current guest session.
      """
      requestScreenControl(
        input: RequestScreenControlInput!
      ): RequestScreenControlPayload

      """
      Org owner/member resolves a pending control request.
      """
      respondToScreenControlRequest(
        input: RespondToScreenControlRequestInput!
      ): RespondToScreenControlRequestPayload
    }

    input RequestScreenControlInput {
      screenId: UUID!
      note: String
    }
    type RequestScreenControlPayload {
      """
      Set when the policy required manual approval.
      """
      request: ScreenControlRequest @pgField
      """
      Set when control is granted.
      """
      activeController: ScreenActiveController @pgField
    }

    input RespondToScreenControlRequestInput {
      requestId: UUID!
      approved: Boolean!
    }
    type RespondToScreenControlRequestPayload {
      request: ScreenControlRequest! @pgField
      activeController: ScreenActiveController @pgField
    }
  `,
  resolvers: {
    Mutation: {
      async requestScreenControl(_mutation, args, context: OurGraphQLContext) {
        const { pgClient, rootPgPool, sessionId, screenGuestSessionId, req } =
          context;
        const { screenId, note } = args.input;

        const {
          rows: [orgRow],
        } = await rootPgPool.query(
          `select organization_id from app_public.screens where id = $1`,
          [screenId],
        );
        if (!orgRow) {
          throw new Error("Screen not found");
        }

        const isOrgMember = sessionId
          ? await isMemberOfOrg(pgClient, orgRow.organization_id)
          : false;
        if (isOrgMember) {
          return {
            data: {
              screenId: null,
              requestId: null,
            } as ScreenControlResultIdentifiers,
          };
        }

        if (!screenGuestSessionId) {
          throw new Error("Not authenticated as a guest");
        }

        const client = await rootPgPool.connect();
        try {
          await client.query("BEGIN");

          const {
            rows: [screenRow],
          } = await client.query(
            `
              select s.id,
                     s.organization_id,
                     s.anon_guest_enabled,
                     s.anon_guest_on_empty_policy,
                     s.anon_guest_on_takeover_policy,
                     s.registered_guest_enabled,
                     s.registered_guest_on_empty_policy,
                     s.registered_guest_on_takeover_policy
              from app_public.screens s
              where s.id = $1
              for no key update
            `,
            [screenId],
          );
          if (!screenRow) {
            throw new Error("Screen not found");
          }

          const {
            rows: [acRow],
          } = await client.query(
            `
              select screen_guest_session_id
              from app_public.screen_active_controllers
              where screen_id = $1
            `,
            [screenId],
          );
          const activeSessionId: string | null =
            acRow?.screen_guest_session_id ?? null;

          // Check guest session
          const {
            rows: [guestRow],
          } = await client.query(
            `
              select id, kind, organization_id, screen_id
              from app_public.screen_guest_sessions
              where id = $1
            `,
            [screenGuestSessionId],
          );
          if (!guestRow) {
            if (req?.session) {
              (req.session as any).screenGuestSession = undefined;
            }
            throw new Error(
              "Your guest session has expired. Refresh the page and sign in again.",
            );
          }
          if (guestRow.screen_id !== screenRow.id) {
            if (req?.session) {
              (req.session as any).screenGuestSession = undefined;
            }
            throw new Error(
              "Your guest session is for a different screen. Refresh the page and sign in again.",
            );
          }

          const alreadyControlled = activeSessionId === screenGuestSessionId;
          if (alreadyControlled) {
            await client.query("COMMIT");
            return {
              data: {
                screenId,
                requestId: null,
              } as ScreenControlResultIdentifiers,
            };
          }

          // Now let's get the policy
          const { outcome, isTakeover } = resolveScreenControlPolicy({
            hasActiveController: !!activeSessionId,
            kind: guestRow.kind as ScreenGuestSessionKind,
            anon_guest_enabled: screenRow.anon_guest_enabled,
            registered_guest_enabled: screenRow.registered_guest_enabled,
            anon_guest_on_empty_policy: screenRow.anon_guest_on_empty_policy,
            anon_guest_on_takeover_policy:
              screenRow.anon_guest_on_takeover_policy,
            registered_guest_on_empty_policy:
              screenRow.registered_guest_on_empty_policy,
            registered_guest_on_takeover_policy:
              screenRow.registered_guest_on_takeover_policy,
          });

          // If allowed, then let's set them to be the controller
          if (outcome === "auto") {
            await client.query(
              `
                insert into app_public.screen_active_controllers
                  (screen_id, screen_guest_session_id)
                values ($1, $2)
                on conflict (screen_id) do update
                  set screen_guest_session_id = excluded.screen_guest_session_id,
                      acquired_at = now()
              `,
              [screenId, screenGuestSessionId],
            );
            if (isTakeover) {
              await client.query(
                `
                  update app_public.screens
                  set current_project_id = null
                  where id = $1
                    and current_project_id is not null
                `,
                [screenId],
              );
            }
            await client.query("COMMIT");
            return {
              data: {
                screenId,
                requestId: null,
              } as ScreenControlResultIdentifiers,
            };
          }

          // Otherwise, we request control to admin
          const {
            rows: [requestRow],
          } = await client.query(
            `
              insert into app_public.screen_control_requests
                (screen_id, screen_guest_session_id, request_type, note)
              values ($1, $2, $3, $4)
              returning id
            `,
            [
              screenId,
              screenGuestSessionId,
              isTakeover ? "takeover" : "acquire",
              note ?? null,
            ],
          );

          await client.query("COMMIT");
          // screenId is intentionally null here, the request is pending,
          return {
            data: {
              screenId: null,
              requestId: requestRow.id,
            } as ScreenControlResultIdentifiers,
          };
        } catch (e) {
          await client.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },

      async respondToScreenControlRequest(
        _mutation,
        args,
        context: OurGraphQLContext,
      ) {
        const { pgClient, rootPgPool } = context;
        const { requestId, approved } = args.input;

        const {
          rows: [reqAuthRow],
        } = await pgClient.query(
          `
            select r.id
            from app_public.screen_control_requests r
            join app_public.screens s on s.id = r.screen_id
            where r.id = $1
              and s.organization_id in (
                select app_public.current_user_member_organization_ids()
              )
          `,
          [requestId],
        );
        if (!reqAuthRow) {
          throw new Error("Request not found");
        }

        const {
          rows: [userRow],
        } = await pgClient.query(`select app_public.current_user_id() as id`);
        if (!userRow?.id) {
          throw new Error("Not authenticated");
        }

        const client = await rootPgPool.connect();
        try {
          await client.query("BEGIN");

          const {
            rows: [reqRow],
          } = await client.query(
            `
              select id,
                     screen_id,
                     screen_guest_session_id,
                     request_type,
                     status
              from app_public.screen_control_requests
              where id = $1
              for update
            `,
            [requestId],
          );
          if (!reqRow) {
            throw new Error("Request not found");
          }
          if (reqRow.status !== "pending") {
            throw new Error("Request is no longer pending");
          }

          // Serialise with requestScreenControl on the same screen.
          await client.query(
            `select 1 from app_public.screens where id = $1 for no key update`,
            [reqRow.screen_id],
          );

          if (!approved) {
            await client.query(
              `
                update app_public.screen_control_requests
                set status = 'denied',
                    resolved_by_user_id = $2,
                    resolved_at = now()
                where id = $1
              `,
              [requestId, userRow.id],
            );
            await client.query("COMMIT");
            return {
              data: {
                screenId: reqRow.screen_id,
                requestId,
              } as ScreenControlResultIdentifiers,
            };
          }

          // If approve
          // Set to control
          await client.query(
            `
              insert into app_public.screen_active_controllers
                (screen_id, screen_guest_session_id)
              values ($1, $2)
              on conflict (screen_id) do update
                set screen_guest_session_id = excluded.screen_guest_session_id,
                    acquired_at = now()
            `,
            [reqRow.screen_id, reqRow.screen_guest_session_id],
          );

          if (reqRow.request_type === "takeover") {
            await client.query(
              `
                update app_public.screens
                set current_project_id = null
                where id = $1
                  and current_project_id is not null
              `,
              [reqRow.screen_id],
            );
          }

          // And update the request
          await client.query(
            `
              update app_public.screen_control_requests
              set status = 'approved',
                  resolved_by_user_id = $2,
                  resolved_at = now()
              where id = $1
            `,
            [requestId, userRow.id],
          );

          await client.query("COMMIT");
          return {
            data: {
              screenId: reqRow.screen_id,
              requestId,
            } as ScreenControlResultIdentifiers,
          };
        } catch (e) {
          await client.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
    },

    RequestScreenControlPayload: {
      activeController: resolveActiveController,
      request: resolveRequest,
    },

    RespondToScreenControlRequestPayload: {
      activeController: resolveActiveController,
      request: resolveRequest,
    },
  },
}));

export default screenControlRequestPlugin;
