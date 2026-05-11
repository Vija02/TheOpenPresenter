import { Pool } from "pg";

import { OurGraphQLContext } from "../../graphile.config";

export type ScreenGuestSessionKind = "anon" | "registered";

export async function cleanupScreenGuestSession(
  pool: Pool,
  sessionId: string,
): Promise<void> {
  await pool.query(
    `
      update app_public.screens
      set current_project_id = null
      where id = (
        select screen_id
        from app_public.screen_active_controllers
        where screen_guest_session_id = $1
      )
        and current_project_id is not null
    `,
    [sessionId],
  );
  await pool.query(
    `delete from app_public.screen_guest_sessions where id = $1`,
    [sessionId],
  );
}

export type OnEmptyPolicy = "allow" | "request";
export type OnTakeoverPolicy = "allow" | "request" | "timer";

export type ScreenControlPolicyInput = {
  hasActiveController: boolean;
  kind: ScreenGuestSessionKind;
  anon_guest_enabled: boolean;
  registered_guest_enabled: boolean;
  anon_guest_on_empty_policy: OnEmptyPolicy;
  anon_guest_on_takeover_policy: OnTakeoverPolicy;
  registered_guest_on_empty_policy: OnEmptyPolicy;
  registered_guest_on_takeover_policy: OnTakeoverPolicy;
};

export type ScreenControlPolicyDecision = {
  action: "on_empty" | "on_takeover";
  outcome: "auto" | "request";
  isTakeover: boolean;
};

// TODO: Handle timer
export function resolveScreenControlPolicy(
  input: ScreenControlPolicyInput,
): ScreenControlPolicyDecision {
  const roleEnabled =
    input.kind === "anon"
      ? input.anon_guest_enabled
      : input.registered_guest_enabled;
  if (!roleEnabled) {
    throw new Error("Guest access is disabled for this screen");
  }

  const action: "on_empty" | "on_takeover" = input.hasActiveController
    ? "on_takeover"
    : "on_empty";

  let outcome: "auto" | "request";
  if (action === "on_empty") {
    const ep: OnEmptyPolicy =
      input.kind === "anon"
        ? input.anon_guest_on_empty_policy
        : input.registered_guest_on_empty_policy;
    outcome = ep === "allow" ? "auto" : "request";
  } else {
    const tp: OnTakeoverPolicy =
      input.kind === "anon"
        ? input.anon_guest_on_takeover_policy
        : input.registered_guest_on_takeover_policy;
    outcome = tp === "allow" ? "auto" : "request";
  }

  return { action, outcome, isTakeover: action === "on_takeover" };
}

export async function isMemberOfOrg(
  pgClient: OurGraphQLContext["pgClient"],
  organizationId: string,
): Promise<boolean> {
  const {
    rows: [row],
  } = await pgClient.query(
    `
      select $1 in (select app_public.current_user_member_organization_ids()) as is_member
    `,
    [organizationId],
  );
  return !!row?.is_member;
}

export type ScreenControlResultIdentifiers = {
  screenId: string | null;
  requestId: string | null;
};

export const resolveActiveController = async (
  parent: any,
  _args: any,
  _context: any,
  resolveInfo: any,
) => {
  const { selectGraphQLResultFromTable, build } = resolveInfo.graphile;
  const sql = build.pgSql;
  const screenId: string | null = parent?.data?.screenId ?? null;
  if (!screenId) return null;
  const [row] = await selectGraphQLResultFromTable(
    sql.fragment`app_public.screen_active_controllers`,
    (alias: any, qb: any) => {
      qb.where(sql.fragment`${alias}.screen_id = ${sql.value(screenId)}`);
    },
  );
  return row ?? null;
};

export const resolveRequest = async (
  parent: any,
  _args: any,
  _context: any,
  resolveInfo: any,
) => {
  const { selectGraphQLResultFromTable, build } = resolveInfo.graphile;
  const sql = build.pgSql;
  const requestId: string | null = parent?.data?.requestId ?? null;
  if (!requestId) return null;
  const [row] = await selectGraphQLResultFromTable(
    sql.fragment`app_public.screen_control_requests`,
    (alias: any, qb: any) => {
      qb.where(sql.fragment`${alias}.id = ${sql.value(requestId)}`);
    },
  );
  return row ?? null;
};
