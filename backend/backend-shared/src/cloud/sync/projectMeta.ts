import { AllProjectMetadataQuery } from "@repo/graphql";
import { generateSlug } from "random-word-slugs";

import { WithPgClient } from "../../types";
import { SyncedCategory } from "./categories";
import { SyncedTag } from "./tags";

type ExternalProject = NonNullable<
  NonNullable<AllProjectMetadataQuery["organizationBySlug"]>["projects"]
>["nodes"][number];

type SyncProjectMetaParams = {
  cloudConnection: {
    id: string;
    organization_id: string;
    creator_user_id: string | null;
  };
  localProjects: { id: string; cloud_project_id: string | null }[];
  allExternalProjectIds: string[];
  externalProjects: ExternalProject[];
  categoriesMap: SyncedCategory[];
  tagsMap: SyncedTag[];
};

/**
 * Sync the metadata of the projects including tags
 * We also delete projects that has been deleted in the cloud
 */
export const syncProjectMeta = async (
  withPgClient: WithPgClient,
  {
    cloudConnection,
    localProjects,
    allExternalProjectIds,
    externalProjects,
    categoriesMap,
    tagsMap,
  }: SyncProjectMetaParams,
): Promise<{ mapping: Map<string, string>; deletedCount: number }> => {
  // Delete local projects whose cloud project no longer exists
  const projectIdsToDelete = localProjects
    .filter(
      (localProject) =>
        !allExternalProjectIds.includes(localProject.cloud_project_id ?? ""),
    )
    .map((localProject) => localProject.id);
  await withPgClient((pgClient) =>
    pgClient.query(`DELETE FROM app_public.projects WHERE id = ANY($1)`, [
      projectIdsToDelete,
    ]),
  );

  // Upsert project metadata
  const createdOrUpdatedProjects = await withPgClient(async (pgClient) => {
    await pgClient.query("SET session_replication_role = replica;");
    const { rows } = await pgClient.query(
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
          externalProjects.map((externalProject) => ({
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
    return rows;
  });

  const externalToLocalProjectIdMapping = new Map<string, string>(
    createdOrUpdatedProjects.map((localProject) => [
      localProject.cloud_project_id,
      localProject.id,
    ]),
  );

  // Create the project-tag connections
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
          externalProjects.flatMap((externalProject) =>
            externalProject.projectTags.nodes.map((x) => ({
              project_id: externalToLocalProjectIdMapping.get(
                externalProject.id,
              ),
              tag_id: tagsMap.find((tagMap) => tagMap.name === x.tag?.name)?.id,
            })),
          ),
        ),
      ],
    ),
  );

  // Remove trailing project tags (no longer present on the cloud)
  const { rows: localProjectTags } = await withPgClient((pgClient) =>
    pgClient.query(
      `
        SELECT project_id, tag_id FROM app_public.project_tags
          WHERE project_id = ANY($1)
      `,
      [
        externalProjects
          .map((externalProject) =>
            externalToLocalProjectIdMapping.get(externalProject.id),
          )
          .filter((id): id is string => id != null),
      ],
    ),
  );
  const desiredProjectTags = externalProjects.flatMap((externalProject) =>
    externalProject.projectTags.nodes.map((pt) => ({
      project_id: externalToLocalProjectIdMapping.get(externalProject.id),
      tag_id: tagsMap.find((tagMap) => tagMap.name === pt.tag?.name)?.id,
    })),
  );
  const projectTagsToDelete = localProjectTags.filter(
    (localProjectTag) =>
      !desiredProjectTags.some(
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

  return {
    mapping: externalToLocalProjectIdMapping,
    deletedCount: projectIdsToDelete.length,
  };
};
