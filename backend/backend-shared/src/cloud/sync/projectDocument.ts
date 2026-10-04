import { ProjectDocumentDocument, ProjectDocumentQuery } from "@repo/graphql";
import { logger } from "@repo/observability";

import { WithPgClient } from "../../types";
import { getUrqlClientFromCloudConnection } from "../urqlClientFromCloudConnection";
import {
  bytesFromPostgraphileBytea,
  hasChangesMissingFrom,
  mergeYjsDocuments,
} from "./documentMerge";
import { pushToRemoteProjectDocument } from "./remoteDocument";

/**
 * Merge the local and remote documents for a project, in both directions.
 * Since they're yjs documents, we merge them.
 */
export const syncProjectDocument = async (
  withPgClient: WithPgClient,
  projectId: string,
) => {
  const {
    rows: [projectAndCloudConnection],
  } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        select p.*, cc.host, cc.session_cookie, cc.target_organization_slug
        from app_public.projects p
        join app_public.cloud_connections cc on p.cloud_connection_id = cc.id
        where p.id = $1
      `,
      [projectId],
    ),
  );

  if (!projectAndCloudConnection) {
    logger.warn({ projectId }, "Project not found; skipping document sync");
    return;
  }
  if (!projectAndCloudConnection.cloud_connection_id) {
    logger.warn(
      { projectId },
      "Cloud connection not available; skipping document sync",
    );
    return;
  }

  const urqlClient = getUrqlClientFromCloudConnection(
    projectAndCloudConnection,
  );

  const projectDocumentRes = await urqlClient.query<ProjectDocumentQuery>(
    ProjectDocumentDocument,
    {
      projectId: projectAndCloudConnection.cloud_project_id,
    },
  );
  if (projectDocumentRes.error) {
    throw projectDocumentRes.error;
  }

  const remoteDocument = projectDocumentRes.data?.project?.document;
  const remote = remoteDocument
    ? bytesFromPostgraphileBytea(remoteDocument)
    : null;

  const localDocument = projectAndCloudConnection.document as Buffer | null;
  const local =
    localDocument && localDocument.length > 0
      ? new Uint8Array(localDocument)
      : null;

  let remoteState = remote;
  if (local && localHasChangesForRemote(projectId, local, remote)) {
    remoteState = await pushToRemoteProjectDocument({
      host: projectAndCloudConnection.host,
      sessionCookie: projectAndCloudConnection.session_cookie,
      remoteProjectId: projectAndCloudConnection.cloud_project_id,
      update: local,
    });
    logger.info({ projectId }, "Pushed local document changes to the cloud");
  }

  if (!remoteState) {
    logger.debug({ projectId }, "Remote project has no document yet; skipping");
    return;
  }

  await withPgClient(async (pgClient) => {
    await pgClient.query("BEGIN");
    try {
      // `replica` skips triggers, so merging a document does not bump`updated_at`;
      await pgClient.query("SET LOCAL session_replication_role = replica;");
      const {
        rows: [current],
      } = await pgClient.query(
        `select document from app_public.projects where id = $1 for update`,
        [projectId],
      );
      if (!current) {
        await pgClient.query("ROLLBACK");
        return;
      }
      const currentLocal = current.document as Buffer | null;
      const merged = mergeYjsDocuments(
        currentLocal && currentLocal.length > 0
          ? new Uint8Array(currentLocal)
          : null,
        remoteState,
      );
      await pgClient.query(
        `
          UPDATE app_public.projects
            SET document = $1
            WHERE id = $2
        `,
        [Buffer.from(merged), projectId],
      );
      await pgClient.query("COMMIT");
    } catch (err) {
      await pgClient.query("ROLLBACK");
      throw err;
    }
  });
};

const localHasChangesForRemote = (
  projectId: string,
  local: Uint8Array,
  remote: Uint8Array | null,
): boolean => {
  try {
    return hasChangesMissingFrom(local, remote);
  } catch (err) {
    logger.warn(
      { err, projectId },
      "Could not decode the local project document; not pushing it",
    );
    return false;
  }
};
