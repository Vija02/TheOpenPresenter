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
};

/**
 * Both sides build the value with this, and compare it with jsonb equality, so
 * it must produce the same jsonb on each. Hence the `C` collation: tag order
 * must not depend on either server's locale.
 */
export const projectSyncValueSql = (alias: string): string => `
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
  )
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
    `update app_public.projects
     set name = $2, target_date = $3::timestamptz, category_id = $4
     where id = $1`,
    [project.id, value.name, value.targetDate, refs!.category_id],
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
