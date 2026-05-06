import { OurGraphQLContext } from "../../graphile.config";

export type ScreenGuestSessionKind = "anon" | "registered";

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

export async function loadResultPayloads(
  resolveInfo: any,
  ids: { screenId: string; requestId: string | null },
) {
  const { selectGraphQLResultFromTable } = resolveInfo.graphile;
  const { pgSql: sql } = resolveInfo.graphile.build;

  const acRows = await selectGraphQLResultFromTable(
    sql.fragment`app_public.screen_active_controllers`,
    (alias: any, qb: any) => {
      qb.where(sql.fragment`${alias}.screen_id = ${sql.value(ids.screenId)}`);
    },
  );
  let reqRows: any[] = [];
  if (ids.requestId) {
    reqRows = await selectGraphQLResultFromTable(
      sql.fragment`app_public.screen_control_requests`,
      (alias: any, qb: any) => {
        qb.where(sql.fragment`${alias}.id = ${sql.value(ids.requestId)}`);
      },
    );
  }
  return {
    data: {
      activeController: acRows[0] ?? null,
      request: reqRows[0] ?? null,
    },
  };
}

export async function loadResponsePayload(
  resolveInfo: any,
  ids: { requestId: string; screenId: string },
) {
  const { selectGraphQLResultFromTable } = resolveInfo.graphile;
  const { pgSql: sql } = resolveInfo.graphile.build;
  const reqRows = await selectGraphQLResultFromTable(
    sql.fragment`app_public.screen_control_requests`,
    (alias: any, qb: any) => {
      qb.where(sql.fragment`${alias}.id = ${sql.value(ids.requestId)}`);
    },
  );
  const acRows = await selectGraphQLResultFromTable(
    sql.fragment`app_public.screen_active_controllers`,
    (alias: any, qb: any) => {
      qb.where(sql.fragment`${alias}.screen_id = ${sql.value(ids.screenId)}`);
    },
  );
  return {
    data: {
      request: reqRows[0] ?? null,
      activeController: acRows[0] ?? null,
    },
  };
}

export async function loadScreenPayload(resolveInfo: any, screenId: string) {
  const { selectGraphQLResultFromTable } = resolveInfo.graphile;
  const { pgSql: sql } = resolveInfo.graphile.build;
  const rows = await selectGraphQLResultFromTable(
    sql.fragment`app_public.screens`,
    (alias: any, qb: any) => {
      qb.where(sql.fragment`${alias}.id = ${sql.value(screenId)}`);
    },
  );
  return { data: { screen: rows[0] } };
}
