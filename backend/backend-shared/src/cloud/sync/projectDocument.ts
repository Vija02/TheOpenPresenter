import { ProjectDocumentDocument, ProjectDocumentQuery } from "@repo/graphql";

import { WithPgClient } from "../../types";
import { getUrqlClientFromCloudConnection } from "../urqlClientFromCloudConnection";

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
    console.error("Project not found; skipping document sync");
    return;
  }
  if (!projectAndCloudConnection.cloud_connection_id) {
    console.error("Cloud connection not available; skipping document sync");
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

  await withPgClient(async (pgClient) => {
    await pgClient.query("SET session_replication_role = replica;");
    await pgClient.query(
      `
        UPDATE app_public.projects
          SET document = $1
          WHERE id = $2
      `,
      [projectDocumentRes.data?.project?.document, projectId],
    );
  });
};
