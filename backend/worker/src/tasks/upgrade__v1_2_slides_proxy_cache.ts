import { Task } from "graphile-worker";
import * as Y from "yjs";

import { upgradeSlidesDocument } from "../migrations/slidesProxyCache";

/**
 * Points already-imported Google Slides at the proxy cache, so they render
 * without internet once viewed. See `../migrations/slidesProxyCache.ts`.
 */
const task: Task = async (_, { withPgClient }) => {
  const { rows: projects } = await withPgClient((pgClient) =>
    pgClient.query(
      `select id, document from app_public.projects where document is not null`,
    ),
  );

  for (const project of projects) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, project.document);

      if (!upgradeSlidesDocument(ydoc)) continue;

      await withPgClient(async (pgClient) => {
        await pgClient.query("BEGIN");
        try {
          // `replica` skips triggers, so the upgrade doesn't bump `updated_at`
          await pgClient.query("SET LOCAL session_replication_role = replica;");
          await pgClient.query(
            "update app_public.projects set document = $1 where id = $2",
            [Buffer.from(Y.encodeStateAsUpdate(ydoc)), project.id],
          );
          await pgClient.query("COMMIT");
        } catch (e) {
          await pgClient.query("ROLLBACK");
          throw e;
        }
      });
    } catch (e) {
      console.error("Failed to upgrade project id: " + project.id, e);
    }
  }
};

module.exports = task;
