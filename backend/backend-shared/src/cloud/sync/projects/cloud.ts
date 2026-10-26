import type { QueryResult, QueryResultRow } from "pg";

import {
  ProjectSyncValue,
  ProjectSyncVersion,
  applyProjectSyncValue,
  projectSyncValueSql,
} from "./value";

/**
 * The cloud's side of project sync. Every function runs on the caller's own
 * connection, so the projects' RLS decides what they may read and write.
 * Documents are not here: they merge over `/wlink`.
 */

type Queryable = {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

export type CloudProject = {
  id: string;
  createdAt: string;
  updatedAt: string;
  value: ProjectSyncValue;
};

export type ProjectPushChange = {
  id: string;
  /** What the change was based on; null to create. */
  expected: { value: ProjectSyncValue; updatedAt: string } | null;
  /** Null to delete. */
  value: ProjectSyncValue | null;
  /** For a create. */
  slug?: string;
};

export type ProjectPushResult =
  | { status: "applied"; updatedAt: string | null }
  | { status: "rejected"; reason: string };

export const listCloudProjects = async (
  client: Queryable,
  organizationId: string,
  version: ProjectSyncVersion = 1,
): Promise<CloudProject[]> => {
  const {
    rows: [row],
  } = await client.query<{ projects: CloudProject[] }>(
    `
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'createdAt', p.created_at,
        'updatedAt', p.updated_at,
        'value', ${projectSyncValueSql("p", version)}
      )), '[]'::jsonb) as projects
      from app_public.projects p
      where p.organization_id = $1 and not p.is_temporary
    `,
    [organizationId],
  );
  return row!.projects;
};

/**
 * Apply local changes, each only if the cloud project still has the metadata
 * the change was based on. A delete also needs an unchanged `updated_at`, so
 * a document edited on the cloud meanwhile keeps the project.
 *
 * Must run inside a transaction: each change gets a savepoint, so one bad
 * project (e.g. naming a tag the cloud lacks) rejects only itself.
 */
export const applyPushedProjectChanges = async (
  client: Queryable,
  organizationId: string,
  userId: string | null,
  changes: ProjectPushChange[],
  version: ProjectSyncVersion = 1,
): Promise<ProjectPushResult[]> => {
  const results: ProjectPushResult[] = [];
  for (const change of changes) {
    await client.query("savepoint cloud_project_push");
    try {
      const result = await applyOne(
        client,
        organizationId,
        userId,
        change,
        version,
      );
      if (result.status === "applied") {
        await client.query("release savepoint cloud_project_push");
      } else {
        await client.query("rollback to savepoint cloud_project_push");
      }
      results.push(result);
    } catch (err) {
      await client.query("rollback to savepoint cloud_project_push");
      results.push({
        status: "rejected",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
};

const applyOne = async (
  client: Queryable,
  organizationId: string,
  userId: string | null,
  change: ProjectPushChange,
  version: ProjectSyncVersion,
): Promise<ProjectPushResult> => {
  const {
    rows: [current],
  } = await client.query<{
    value_matches: boolean;
    updated_at_matches: boolean;
    same_as_pushed: boolean;
  }>(
    `
      select ${projectSyncValueSql("p", version)} = $3::jsonb as value_matches,
        p.updated_at = $4::timestamptz as updated_at_matches,
        ${projectSyncValueSql("p", version)} = $5::jsonb as same_as_pushed
      from app_public.projects p
      where p.id = $1 and p.organization_id = $2
      for update
    `,
    [
      change.id,
      organizationId,
      JSON.stringify(change.expected?.value ?? null),
      change.expected?.updatedAt ?? null,
      JSON.stringify(change.value),
    ],
  );

  if (!change.expected) {
    // A create whose response was lost arrives again: already done.
    if (current?.same_as_pushed) return applied(client, change.id);
    if (current) return rejected("already exists on the cloud");
  } else if (!current) {
    return rejected("missing on the cloud");
  } else if (!current.value_matches) {
    return rejected("changed on the cloud");
  }

  if (!change.value) {
    if (!current!.updated_at_matches) return rejected("changed on the cloud");
    await client.query("delete from app_public.projects where id = $1", [
      change.id,
    ]);
    return { status: "applied", updatedAt: null };
  }

  if (!current) {
    // A slug taken here gets a suffix rather than failing the create. The
    // next sync then takes this slug back to the side that pushed it.
    await client.query(
      `insert into app_public.projects
         (id, organization_id, creator_user_id, slug, name)
       values ($1, $2, $3,
         case when exists (
           select 1 from app_public.projects
           where organization_id = $2 and slug = $4
         ) then $4 || '-' || substr(md5(random()::text), 1, 6)
         else $4 end,
         $5)`,
      [change.id, organizationId, userId, change.slug, change.value.name],
    );
  }
  const { missing } = await applyProjectSyncValue(
    client,
    { id: change.id, organizationId },
    change.value,
  );
  if (missing.length > 0) {
    return rejected(`the cloud has no ${missing.join(", ")}`);
  }
  return applied(client, change.id);
};

const applied = async (
  client: Queryable,
  id: string,
): Promise<ProjectPushResult> => {
  const {
    rows: [row],
  } = await client.query<{ updated_at: string }>(
    `select to_jsonb(updated_at) #>> '{}' as updated_at
     from app_public.projects where id = $1`,
    [id],
  );
  return { status: "applied", updatedAt: row!.updated_at };
};

const rejected = (reason: string): ProjectPushResult => ({
  status: "rejected",
  reason,
});
