import { cloud } from "@repo/backend-shared";
import {
  AllProjectMetadataDocument,
  AllProjectMetadataQuery,
  AllProjectUpdatedAtDocument,
  AllProjectUpdatedAtQuery,
} from "@repo/graphql";
import { Task } from "graphile-worker";
import { generateSlug } from "random-word-slugs";

interface CloudConnectionSyncPayload {
  /**
   * request id
   */
  id: string;
  force_resync?: boolean;
}

// TODO: Consider if categories or tags changes
const task: Task = async (inPayload, { addJob, withPgClient }) => {
  try {
    const payload: CloudConnectionSyncPayload = inPayload as any;
    const { id: cloudConnectionId, force_resync } = payload;
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
          SELECT id, cloud_project_id, updated_at FROM app_public.projects WHERE cloud_connection_id = $1
        `,
        [cloudConnectionId],
      ),
    );

    const externalProjectIdsToCreateOrUpdate =
      projectUpdatedRes.data?.organizationBySlug?.projects.nodes
        .filter((cloudProject) => {
          if (force_resync) {
            return true;
          }

          const foundInCurrentProject = localProjects.find(
            (currentProject) =>
              cloudProject.id === currentProject.cloud_project_id,
          );
          return (
            !foundInCurrentProject ||
            new Date(foundInCurrentProject.updated_at).getTime() !==
              new Date(cloudProject.updatedAt).getTime()
            // TODO: Handle if it's after??
          );
        })
        .map((x) => x.id);

    const res = await urqlClient.query<AllProjectMetadataQuery>(
      AllProjectMetadataDocument,
      {
        slug: cloudConnection.target_organization_slug,
        projectIds: externalProjectIdsToCreateOrUpdate,
      },
    );

    if (res.error) {
      throw res.error;
    }

    // ========================================================================== //
    // =============================== CATEGORIES =============================== //
    // ========================================================================== //
    const requiredCategories =
      res.data?.organizationBySlug?.projects.nodes
        .map((x) => x.category?.name)
        .filter((name): name is string => name != null) || [];

    const categoriesMap: { id: string; name: string }[] = [];
    const { rows: currentCategories } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          SELECT * FROM app_public.categories WHERE name = ANY($1) AND organization_id = $2
        `,
        [requiredCategories, cloudConnection.organization_id],
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

    // ========================================================================== //
    // ================================== TAGS ================================== //
    // ========================================================================== //
    // Tags have multiple fields. But we'll only match based on name here. So the style might look different
    // if we already have something defined locally that has the same name.
    const requiredTags =
      res.data?.organizationBySlug?.projects.nodes
        .flatMap((x) => x.projectTags.nodes.flatMap((y) => y.tag?.name))
        .filter((name): name is string => name != null) || [];

    const tagsMap: { id: string; name: string }[] = [];
    const { rows: currentTags } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          SELECT * FROM app_public.tags WHERE name = ANY($1) AND organization_id = $2
        `,
        [requiredTags, cloudConnection.organization_id],
      ),
    );
    tagsMap.push(...currentTags);

    // Create missing tags
    const existingTagNames = new Set(tagsMap.map((cat) => cat.name));
    const missingTags = Array.from(
      new Set(requiredTags.filter((name) => !existingTagNames.has(name))),
    );

    const missingTagsFullData = missingTags.map(
      (missingTag) =>
        res.data?.organizationBySlug?.tags.nodes.find(
          (tag) => tag.name === missingTag,
        )!,
    );

    if (missingTags.length > 0) {
      const { rows: newTags } = await withPgClient((pgClient) =>
        pgClient.query(
          `
            INSERT INTO app_public.tags (name, description, background_color, foreground_color, variant, organization_id)
              SELECT name, description, background_color, foreground_color, variant, organization_id
              FROM jsonb_to_recordset($1) AS t (name text, description text, background_color text, foreground_color text, variant text, organization_id uuid)
            RETURNING *
          `,
          [
            JSON.stringify(
              missingTagsFullData.map((tag) => ({
                name: tag.name,
                description: tag.description,
                background_color: tag.backgroundColor,
                foreground_color: tag.foregroundColor,
                variant: tag.variant,
                organization_id: cloudConnection.organization_id,
              })),
            ),
          ],
        ),
      );

      // Add newly created tags to the tagsMap
      tagsMap.push(...newTags);
    }

    // ========================================================================== //
    // ========================= Now handle project data ======================== //
    // ========================================================================== //
    const externalProjectsToCreateOrUpdate =
      res.data?.organizationBySlug?.projects.nodes.filter((externalProject) =>
        externalProjectIdsToCreateOrUpdate?.includes(externalProject.id),
      ) ?? [];

    // Handle deleted projects
    const projectIdsToDelete = localProjects
      .filter(
        (localProject) =>
          !projectUpdatedRes.data?.organizationBySlug?.projects.nodes.some(
            (externalProject) =>
              externalProject.id === localProject.cloud_project_id,
          ),
      )
      .map((localProject) => localProject.id);
    await withPgClient((pgClient) =>
      pgClient.query(
        `
          DELETE FROM app_public.projects WHERE id = ANY($1)
        `,
        [projectIdsToDelete],
      ),
    );

    // Update metadata
    const createdOrUpdatedProjects = await withPgClient(async (pgClient) => {
      await pgClient.query("SET session_replication_role = replica;");
      const { rows: createdOrUpdatedProjects } = await pgClient.query(
        `
          INSERT INTO app_public.projects (organization_id, creator_user_id, slug, created_at, updated_at, name, target_date, category_id, cloud_connection_id, cloud_last_updated, cloud_project_id)
            SELECT organization_id, creator_user_id, slug, created_at, updated_at, name, target_date, category_id, cloud_connection_id, cloud_last_updated, cloud_project_id
            FROM jsonb_to_recordset($1) AS t (organization_id uuid, creator_user_id uuid, slug public.citext, created_at timestamp, updated_at timestamp, name text, target_date timestamp, category_id uuid, cloud_connection_id uuid, cloud_last_updated timestamptz, cloud_project_id uuid)
            ON CONFLICT (organization_id, cloud_project_id) DO UPDATE SET 
              organization_id = excluded.organization_id,
              creator_user_id = excluded.creator_user_id,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              name = excluded.name,
              target_date = excluded.target_date,
              category_id = excluded.category_id,
              cloud_connection_id = excluded.cloud_connection_id,
              cloud_last_updated = excluded.cloud_last_updated,
              cloud_project_id = excluded.cloud_project_id
          RETURNING id, cloud_project_id
        `,
        [
          JSON.stringify(
            externalProjectsToCreateOrUpdate.map((externalProject) => ({
              organization_id: cloudConnection.organization_id,
              creator_user_id: cloudConnection.creator_user_id,
              slug: generateSlug(),
              created_at: externalProject.createdAt,
              updated_at: externalProject.updatedAt,
              name: externalProject.name,
              target_date: externalProject.targetDate,
              category_id: categoriesMap.find(
                (x) => x.name === externalProject.category?.name,
              )?.id,
              cloud_connection_id: cloudConnection.id,
              cloud_last_updated: externalProject.updatedAt,
              cloud_project_id: externalProject.id,
            })),
          ),
        ],
      );
      return createdOrUpdatedProjects;
    });
    const externalToLocalProjectIdMapping = new Map(
      createdOrUpdatedProjects.map((localProject) => [
        localProject.cloud_project_id,
        localProject.id,
      ]),
    );

    // Now create the project-tag connection
    await withPgClient((pgClient) =>
      pgClient.query(
        `
          INSERT INTO app_public.project_tags (project_id, tag_id)
            SELECT project_id, tag_id
            FROM jsonb_to_recordset($1) AS t (project_id uuid, tag_id uuid)
          ON CONFLICT DO NOTHING
        `,
        [
          JSON.stringify(
            externalProjectsToCreateOrUpdate.flatMap((externalProject) =>
              externalProject.projectTags.nodes.map((x) => ({
                project_id: externalToLocalProjectIdMapping.get(
                  externalProject.id,
                ),
                tag_id: tagsMap.find((tagMap) => tagMap.name === x.tag?.name)
                  ?.id,
              })),
            ),
          ),
        ],
      ),
    );

    // Remove trailing project tags
    const { rows: localProjectTags } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          SELECT * FROM app_public.project_tags WHERE project_id = ANY($1)
        `,
        [
          externalProjectIdsToCreateOrUpdate?.map((x) =>
            externalToLocalProjectIdMapping.get(x),
          ),
        ],
      ),
    );
    const projectTagsToCreateOrUpdate =
      externalProjectsToCreateOrUpdate.flatMap((externalProject) =>
        externalProject.projectTags.nodes.map((pt) => ({
          project_id: externalToLocalProjectIdMapping.get(externalProject.id),
          tag_id: tagsMap.find((tagMap) => tagMap.name === pt.tag?.name)?.id,
        })),
      );
    const projectTagsToDelete = localProjectTags.filter(
      (localProjectTag) =>
        !projectTagsToCreateOrUpdate.some(
          (x) =>
            x.project_id === localProjectTag.project_id &&
            x.tag_id === localProjectTag.tag_id,
        ),
    );

    await withPgClient((pgClient) =>
      pgClient.query(
        `
          DELETE FROM app_public.project_tags WHERE 
            (project_id, tag_id) IN (
              SELECT project_id, tag_id
                FROM jsonb_to_recordset($1) AS t (project_id uuid, tag_id uuid)
            )
        `,
        [JSON.stringify(projectTagsToDelete)],
      ),
    );

    if (
      externalProjectIdsToCreateOrUpdate &&
      externalProjectIdsToCreateOrUpdate.length > 0
    ) {
      await Promise.all(
        externalProjectIdsToCreateOrUpdate.map((externalProjectId) => {
          return addJob("project__sync_document_cloud_connection", {
            id: externalToLocalProjectIdMapping.get(externalProjectId),
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
