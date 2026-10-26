/**
 * A project's synced metadata, compared as jsonb. Categories and tags go by
 * name, which is what matches them across the two sides.
 */
export type ProjectSyncValue = {
  name: string;
  /** UTC, microseconds: the same text whatever either server's time zone. */
  targetDate: string | null;
  category: string | null;
  /** Sorted, so equal sets compare equal. */
  tags: string[];
  /** From version 2. Absent for older local instances. */
  slug?: string;
  isPublic?: boolean;
};

/**
 * 1: name, date, category and tags. 2: also slug and isPublic. The cloud is
 * always at least as new as a local instance, but serves older ones the shape
 * they ask for: a value of another shape never compares equal.
 */
export type ProjectSyncVersion = 1 | 2;
export const PROJECT_SYNC_VERSION: ProjectSyncVersion = 2;

/** What a caller asked for, capped at what this side knows. */
export const projectSyncVersion = (
  requested: number | null | undefined,
): ProjectSyncVersion =>
  Math.max(
    1,
    Math.min(requested ?? 1, PROJECT_SYNC_VERSION),
  ) as ProjectSyncVersion;

/**
 * Both sides build the value with this, and compare it with jsonb equality, so
 * it must produce the same jsonb on each. Hence the `C` collation: tag order
 * must not depend on either server's locale.
 */
export const projectSyncValueSql = (
  alias: string,
  version: ProjectSyncVersion = 1,
): string => `
  jsonb_build_object(
    'name', ${alias}.name,
    'targetDate', to_char(
      ${alias}.target_date at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ),
    'category', (
      select c.name from app_public.categories c
      where c.id = ${alias}.category_id
    ),
    'tags', coalesce((
      select jsonb_agg(t.name order by t.name collate "C")
      from app_public.project_tags pt
      join app_public.tags t on t.id = pt.tag_id
      where pt.project_id = ${alias}.id
    ), '[]'::jsonb)
  )${
    version >= 2
      ? ` || jsonb_build_object(
    'slug', ${alias}.slug::text,
    'isPublic', ${alias}.is_public
  )`
      : ""
  }
`;

type Queryable = {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, any>[] }>;
};

/**
 * Point a project at the categories and tags a value names, in the project's
 * own organization. Returns the names that do not exist there, without
 * changing anything; they come from the other side's own category and tag
 * sync, so a missing one is retried next sync rather than invented.
 */
export const applyProjectSyncValue = async (
  client: Queryable,
  project: { id: string; organizationId: string },
  value: ProjectSyncValue,
): Promise<{ missing: string[] }> => {
  const {
    rows: [refs],
  } = await client.query(
    `
      select
        (select id from app_public.categories
         where organization_id = $1 and name = $2) as category_id,
        coalesce((
          select jsonb_object_agg(name, id) from app_public.tags
          where organization_id = $1 and name = any($3::text[])
        ), '{}'::jsonb) as tag_ids
    `,
    [project.organizationId, value.category, value.tags],
  );
  const tagIds = refs!.tag_ids as Record<string, string>;
  const missing = [
    ...(value.category && !refs!.category_id
      ? [`category "${value.category}"`]
      : []),
    ...value.tags.filter((t) => !tagIds[t]).map((t) => `tag "${t}"`),
  ];
  if (missing.length > 0) return { missing };

  await client.query(
    `update app_public.projects p
     set name = $2, target_date = $3::timestamptz, category_id = $4,
       slug = case
         when $5::text is null or exists (
           select 1 from app_public.projects o
           where o.organization_id = p.organization_id
             and o.slug = $5 and o.id <> p.id
         ) then p.slug
         else $5
       end,
       is_public = coalesce($6::boolean, p.is_public)
     where id = $1`,
    [
      project.id,
      value.name,
      value.targetDate,
      refs!.category_id,
      value.slug ?? null,
      value.isPublic ?? null,
    ],
  );
  const ids = Object.values(tagIds);
  await client.query(
    `delete from app_public.project_tags
     where project_id = $1 and tag_id <> all($2::uuid[])`,
    [project.id, ids],
  );
  await client.query(
    `insert into app_public.project_tags (project_id, tag_id)
     select $1, unnest($2::uuid[])
     on conflict do nothing`,
    [project.id, ids],
  );
  return { missing: [] };
};
