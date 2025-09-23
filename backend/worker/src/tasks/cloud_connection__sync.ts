import { cloud } from "@repo/backend-shared";
import {
  AllProjectMetadataDocument,
  AllProjectMetadataQuery,
  AllProjectUpdatedAtDocument,
  AllProjectUpdatedAtQuery,
} from "@repo/graphql";
import { Task } from "graphile-worker";

interface CloudConnectionSyncPayload {
  /**
   * request id
   */
  id: string;
}

const task: Task = async (inPayload, { addJob, withPgClient }) => {
  try {
    const payload: CloudConnectionSyncPayload = inPayload as any;
    const { id: cloudConnectionId } = payload;
    const {
      rows: [cloudConnection],
    } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          select *
          from app_public.cloud_connections
          where id = $1
        `,
        [cloudConnectionId],
      ),
    );
    if (!cloudConnection) {
      console.error("Cloud connection not found; aborting");
      return;
    }
    if (!cloudConnection.target_organization_slug) {
      console.error("Target organization slug not available; aborting");
      return;
    }

    const urqlClient = cloud.getUrqlClientFromCloudConnection(cloudConnection);
    // First, we get the updated_at so we know which ones need to be updated/created
    const projectUpdatedRes = await urqlClient.query<AllProjectUpdatedAtQuery>(
      AllProjectUpdatedAtDocument,
      {
        slug: cloudConnection.target_organization_slug,
      },
    );
    if (projectUpdatedRes.error) {
      throw projectUpdatedRes.error;
    }

    const { rows: localProjects } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          SELECT id, updated_at FROM app_public.projects WHERE id = ANY($1)
        `,
        [
          projectUpdatedRes.data?.organizationBySlug?.projects.nodes.map(
            (x) => x.id,
          ),
        ],
      ),
    );

    const projectIdsToCreateOrUpdate =
      projectUpdatedRes.data?.organizationBySlug?.projects.nodes
        .filter((cloudProject) => {
          const foundInCurrentProject = localProjects.find(
            (currentProject) => cloudProject.id === currentProject.id,
          );
          return (
            !foundInCurrentProject ||
            new Date(foundInCurrentProject.updated_at).getTime() !==
              new Date(cloudProject.updatedAt).getTime()
            // TODO: Handle if it's after??
          );
        })
        .map((x) => x.id);

    // TODO: Delete projects that are deleted

    const res = await urqlClient.query<AllProjectMetadataQuery>(
      AllProjectMetadataDocument,
      {
        slug: cloudConnection.target_organization_slug,
        projectIds: projectIdsToCreateOrUpdate,
      },
    );

    if (res.error) {
      throw res.error;
    }

    const requiredCategories =
      res.data?.organizationBySlug?.projects.nodes
        .map((x) => x.category?.name)
        .filter((name): name is string => name != null) || [];

    const categoriesMap: { id: string; name: string }[] = [];
    const { rows: currentCategories } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          SELECT * FROM app_public.categories WHERE name = ANY($1)
        `,
        [requiredCategories],
      ),
    );
    categoriesMap.push(...currentCategories);

    // Create missing categories
    const existingCategoryNames = new Set(categoriesMap.map((cat) => cat.name));
    const missingCategories = Array.from(
      new Set(
        requiredCategories.filter((name) => !existingCategoryNames.has(name)),
      ),
    );

    if (missingCategories.length > 0) {
      const { rows: newCategories } = await withPgClient((pgClient) =>
        pgClient.query(
          `
            INSERT INTO app_public.categories (name, organization_id)
            SELECT name, $1
            FROM unnest($2::text[]) AS name
            RETURNING *
          `,
          [cloudConnection.organization_id, missingCategories],
        ),
      );

      // Add newly created categories to the categoriesMap
      categoriesMap.push(...newCategories);
    }

    // Update metadata
    await withPgClient(async (pgClient) => {
      await pgClient.query("SET session_replication_role = replica;");
      await pgClient.query(
        `
          INSERT INTO app_public.projects (id, organization_id, creator_user_id, slug, created_at, updated_at, name, target_date, category_id, cloud_connection_id, cloud_last_updated)
            SELECT id, organization_id, creator_user_id, slug, created_at, updated_at, name, target_date, category_id, cloud_connection_id, cloud_last_updated
            FROM jsonb_to_recordset($1) AS t (id uuid, organization_id uuid, creator_user_id uuid, slug public.citext, created_at timestamp, updated_at timestamp, name text, target_date timestamp, category_id uuid, cloud_connection_id uuid, cloud_last_updated timestamptz)
            ON CONFLICT (id) DO UPDATE SET 
              organization_id = excluded.organization_id,
              creator_user_id = excluded.creator_user_id,
              slug = excluded.slug,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              name = excluded.name,
              target_date = excluded.target_date,
              category_id = excluded.category_id,
              cloud_connection_id = excluded.cloud_connection_id,
              cloud_last_updated = excluded.cloud_last_updated
        `,
        [
          JSON.stringify(
            res.data?.organizationBySlug?.projects.nodes.map((project) => ({
              id: project.id,
              organization_id: cloudConnection.organization_id,
              creator_user_id: cloudConnection.creator_user_id,
              slug: project.slug,
              created_at: project.createdAt,
              updated_at: project.updatedAt,
              name: project.name,
              target_date: project.targetDate,
              category_id: categoriesMap.find(
                (x) => x.name === project.category?.name,
              )?.id,
              cloud_connection_id: cloudConnection.id,
              cloud_last_updated: project.updatedAt,
            })),
          ),
        ],
      );
    });

    if (projectIdsToCreateOrUpdate && projectIdsToCreateOrUpdate.length > 0) {
      await Promise.all(
        projectIdsToCreateOrUpdate.map((id) => {
          return addJob("project__sync_document_cloud_connection", {
            id,
          });
        }),
      );
    }
  } catch (e) {
    console.error(e);
    // TODO: Update job status on error
  }
};

module.exports = task;
