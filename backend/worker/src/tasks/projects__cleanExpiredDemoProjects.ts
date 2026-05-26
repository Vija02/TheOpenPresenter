import { Task } from "graphile-worker";

/**
 * Deletes temporary demo projects (created via /init-demo)
 * older than 1 day. Pairs with the per-document cleanup in
 * `installHocuspocus.ts` (which deletes immediately on unload) — this is
 * the safety net for sessions that never cleanly unload (process crash,
 * forced restart, etc.).
 */
const task: Task = async (_, { withPgClient, logger }) => {
  const { rowCount } = await withPgClient((client) =>
    client.query(
      `delete from app_public.projects
       where is_temporary = true
         and organization_id = (
           select id from app_public.organizations where slug = 'demo'
         )
         and created_at < now() - interval '1 day'`,
    ),
  );

  if (rowCount && rowCount > 0) {
    logger.info(
      `Deleted ${rowCount} expired temporary demo project(s) older than 1 day`,
    );
  }
};

export default task;
