import { cloud } from "@repo/backend-shared";
import { ProjectDocumentDocument, ProjectDocumentQuery } from "@repo/graphql";
import { Task } from "graphile-worker";

interface ProjectSyncDocumentPayload {
  /**
   * request id
   */
  id: string;
}

const task: Task = async (inPayload, { addJob, withPgClient }) => {
  try {
    const payload: ProjectSyncDocumentPayload = inPayload as any;
    const { id: projectId } = payload;
    const {
      rows: [projectAndCloudConnection],
    } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          select p.*, cc.host, cc.session_cookie, cc.target_organization_slug
          from app_public.projects p join app_public.cloud_connections cc on p.cloud_connection_id = cc.id
          where p.id = $1
        `,
        [projectId],
      ),
    );

    if (!projectAndCloudConnection) {
      console.error("Project not found; aborting");
      return;
    }
    if (!projectAndCloudConnection.cloud_connection_id) {
      console.error("Cloud connection not available; aborting");
      return;
    }

    const urqlClient = cloud.getUrqlClientFromCloudConnection(
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
  } catch (e) {
    console.error(e);
    // TODO: Update job status on error
  }
};

module.exports = task;
