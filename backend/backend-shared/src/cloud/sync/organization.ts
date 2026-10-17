import type { QueryResult, QueryResultRow } from "pg";

import { WithPgClient } from "../../types";
import { getUrqlClientFromCloudConnection } from "../urqlClientFromCloudConnection";
import { queryCloud } from "./cloudQuery";

/**
 * Two-way sync of the organization's own settings. The name is left out.
 */
export type OrganizationSyncValue = {
  organizationType: string;
  isPublic: boolean;
  experimentalFeaturesEnabled: boolean;
};

/** Both sides build the value with this and compare it as jsonb. */
export const organizationSyncValueSql = (alias: string): string => `
  jsonb_build_object(
    'organizationType', ${alias}.organization_type,
    'isPublic', ${alias}.is_public,
    'experimentalFeaturesEnabled', ${alias}.experimental_features_enabled
  )
`;

type Queryable = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

const applyValue = (
  client: Queryable,
  organizationId: string,
  value: OrganizationSyncValue,
) =>
  client.query(
    `
      update app_public.organizations
      set organization_type = $2::app_public.organization_type,
        is_public = $3,
        experimental_features_enabled = $4
      where id = $1
    `,
    [
      organizationId,
      value.organizationType,
      value.isPublic,
      value.experimentalFeaturesEnabled,
    ],
  );

// ========================================================================== //
// ================================ Cloud side ============================== //
// ========================================================================== //

export const getCloudOrganizationSyncValue = async (
  client: Queryable,
  organizationId: string,
): Promise<OrganizationSyncValue> => {
  const {
    rows: [row],
  } = await client.query<{ value: OrganizationSyncValue }>(
    `select ${organizationSyncValueSql("o")} as value
     from app_public.organizations o where o.id = $1`,
    [organizationId],
  );
  return row!.value;
};

export type OrganizationPushResult =
  | { status: "applied" }
  | { status: "rejected"; reason: string };

/**
 * Apply a local change, only if the cloud still has what it was based on. One
 * conditional update, so nothing can change in between.
 */
export const applyPushedOrganizationChange = async (
  client: Queryable,
  organizationId: string,
  change: { expected: OrganizationSyncValue; value: OrganizationSyncValue },
): Promise<OrganizationPushResult> => {
  const { rowCount } = await client.query(
    `
      update app_public.organizations o
      set organization_type = $2::app_public.organization_type,
        is_public = $3,
        experimental_features_enabled = $4
      where o.id = $1 and ${organizationSyncValueSql("o")} = $5::jsonb
    `,
    [
      organizationId,
      change.value.organizationType,
      change.value.isPublic,
      change.value.experimentalFeaturesEnabled,
      JSON.stringify(change.expected),
    ],
  );
  if (rowCount) return { status: "applied" };

  // Row level security hides the row from an update the user may not make
  const {
    rows: [current],
  } = await client.query<{ matches: boolean }>(
    `select ${organizationSyncValueSql("o")} = $2::jsonb as matches
     from app_public.organizations o where o.id = $1`,
    [organizationId, JSON.stringify(change.expected)],
  );
  return {
    status: "rejected",
    reason: current?.matches
      ? "not allowed on the cloud"
      : "changed on the cloud",
  };
};

// ========================================================================== //
// ================================ Local side ============================== //
// ========================================================================== //

// Not codegen'd: these fields return JSON.
const CLOUD_ORGANIZATION_SYNC_GET = `
  query CloudOrganizationSyncGet($organizationSlug: String!) {
    cloudOrganizationSyncGet(organizationSlug: $organizationSlug)
  }
`;
const CLOUD_ORGANIZATION_SYNC_PUSH = `
  mutation CloudOrganizationSyncPush(
    $organizationSlug: String!
    $expected: JSON!
    $value: JSON!
  ) {
    cloudOrganizationSyncPush(
      organizationSlug: $organizationSlug
      expected: $expected
      value: $value
    )
  }
`;

const ENTITY = "app_public.organizations";

type CloudConnection = {
  id: string;
  host: string;
  session_cookie: string;
  organization_id: string;
  target_organization_slug: string;
};

export type OrganizationSyncResult = {
  action: "unchanged" | "pulled" | "pushed" | "merged" | "pushRejected";
  value: OrganizationSyncValue;
};

/**
 * Like project metadata, compared by content against the value both sides last
 * agreed on, since `updated_at` moves with every other edit:
 *
 *   both the same                     -> record it
 *   never synced                      -> the cloud wins: the local organization
 *                                        was only just created with defaults
 *   edited here only                  -> push
 *   edited on the cloud only          -> pull
 *   edited on both                    -> merge field by field, the cloud
 *                                        winning a field edited on both; push
 *                                        and apply the result here
 */
export const syncOrganization = async (
  withPgClient: WithPgClient,
  cloudConnection: CloudConnection,
): Promise<OrganizationSyncResult> => {
  const urqlClient = getUrqlClientFromCloudConnection(cloudConnection);
  const organizationSlug = cloudConnection.target_organization_slug;
  const organizationId = cloudConnection.organization_id;

  const { cloudOrganizationSyncGet: cloud } = await queryCloud<{
    cloudOrganizationSyncGet: OrganizationSyncValue;
  }>(urqlClient, CLOUD_ORGANIZATION_SYNC_GET, { organizationSlug });

  const {
    rows: [row],
  } = await withPgClient((pgClient) =>
    pgClient.query<{
      local: OrganizationSyncValue;
      state: OrganizationSyncValue | null;
      local_matches_cloud: boolean;
      local_matches_state: boolean | null;
      cloud_matches_state: boolean | null;
    }>(
      `
        select l.value as local, s.synced_value as state,
          l.value = $3::jsonb as local_matches_cloud,
          l.value = s.synced_value as local_matches_state,
          $3::jsonb = s.synced_value as cloud_matches_state
        from (
          select ${organizationSyncValueSql("o")} as value
          from app_public.organizations o where o.id = $2
        ) l
        left join app_private.cloud_sync_rows s
          on s.cloud_connection_id = $1 and s.entity = $4 and s.row_key = '{}'
      `,
      [cloudConnection.id, organizationId, JSON.stringify(cloud), ENTITY],
    ),
  );
  if (!row) throw new Error("Local organization not found");

  const pull = async (value: OrganizationSyncValue) => {
    await withPgClient((pgClient) =>
      applyValue(pgClient, organizationId, value),
    );
  };
  const push = async (value: OrganizationSyncValue) => {
    const { cloudOrganizationSyncPush: result } = await queryCloud<{
      cloudOrganizationSyncPush: OrganizationPushResult;
    }>(
      urqlClient,
      CLOUD_ORGANIZATION_SYNC_PUSH,
      { organizationSlug, expected: cloud, value },
      "mutation",
    );
    return result.status === "applied";
  };
  const record = (value: OrganizationSyncValue) =>
    withPgClient((pgClient) =>
      pgClient.query(
        `
          insert into app_private.cloud_sync_rows
            (cloud_connection_id, entity, row_key, synced_value)
          values ($1, $2, '{}', $3)
          on conflict (cloud_connection_id, entity, row_key) do update
            set synced_value = excluded.synced_value
        `,
        [cloudConnection.id, ENTITY, JSON.stringify(value)],
      ),
    );

  let result: OrganizationSyncResult;
  if (row.local_matches_cloud) {
    result = { action: "unchanged", value: cloud };
  } else if (!row.state || row.local_matches_state) {
    await pull(cloud);
    result = { action: "pulled", value: cloud };
  } else if (row.cloud_matches_state) {
    result = (await push(row.local))
      ? { action: "pushed", value: row.local }
      : { action: "pushRejected", value: row.local };
  } else {
    const merged = mergeOrganizationValues(row.state, row.local, cloud);
    if (!(await push(merged))) {
      // Settled next sync, against whatever the cloud has by then
      return { action: "pushRejected", value: row.local };
    }
    await pull(merged);
    result = { action: "merged", value: merged };
  }

  if (result.action !== "pushRejected") await record(result.value);
  return result;
};

/** Each field from the side that changed it; the cloud's when both did. */
export const mergeOrganizationValues = (
  base: OrganizationSyncValue,
  local: OrganizationSyncValue,
  cloud: OrganizationSyncValue,
): OrganizationSyncValue => {
  const field = <K extends keyof OrganizationSyncValue>(key: K) =>
    local[key] !== base[key] && cloud[key] === base[key]
      ? local[key]
      : cloud[key];
  return {
    organizationType: field("organizationType"),
    isPublic: field("isPublic"),
    experimentalFeaturesEnabled: field("experimentalFeaturesEnabled"),
  };
};
