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
  force_resync?: boolean;
}

// TODO: Consider if categories or tags changes
const task: Task = async (inPayload, { addJob, withPgClient }) => {
  let syncRunId: string | undefined;
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

    // Start tracking
    syncRunId = await cloud.createSyncRun(withPgClient, {
      organizationId: cloudConnection.organization_id,
      cloudConnectionId: cloudConnection.id,
      forceResync: !!force_resync,
    });

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
          );
        })
        .map((x) => x.id) ?? [];

    const allExternalProjectIds =
      projectUpdatedRes.data?.organizationBySlug?.projects.nodes.map(
        (x) => x.id,
      ) ?? [];

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

    await cloud.setSyncRunProjectTargets(withPgClient, syncRunId, {
      total: allExternalProjectIds.length,
      toSync: externalProjectIdsToCreateOrUpdate.length,
    });

    // ========================================================================== //
    // =============================== CATEGORIES =============================== //
    // ========================================================================== //
    const requiredCategories =
      res.data?.organizationBySlug?.projects.nodes
        .map((x) => x.category?.name)
        .filter((name): name is string => name != null) || [];
    const categoriesMap = await cloud.syncCategories(
      withPgClient,
      cloudConnection.organization_id,
      requiredCategories,
    );

    // ========================================================================== //
    // ================================== TAGS ================================== //
    // ========================================================================== //
    const requiredTags =
      res.data?.organizationBySlug?.projects.nodes
        .flatMap((x) => x.projectTags.nodes.flatMap((y) => y.tag?.name))
        .filter((name): name is string => name != null) || [];
    const tagsMap = await cloud.syncTags(
      withPgClient,
      cloudConnection.organization_id,
      requiredTags,
      res.data?.organizationBySlug?.tags.nodes ?? [],
    );

    // ========================================================================== //
    // ========================= Now handle project meta ======================== //
    // ========================================================================== //
    const externalProjectsToCreateOrUpdate =
      res.data?.organizationBySlug?.projects.nodes.filter((externalProject) =>
        externalProjectIdsToCreateOrUpdate.includes(externalProject.id),
      ) ?? [];
    const { mapping: externalToLocalProjectIdMapping, deletedCount } =
      await cloud.syncProjectMeta(withPgClient, {
        cloudConnection: {
          id: cloudConnection.id,
          organization_id: cloudConnection.organization_id,
          creator_user_id: cloudConnection.creator_user_id,
        },
        localProjects,
        allExternalProjectIds,
        externalProjects: externalProjectsToCreateOrUpdate,
        categoriesMap,
        tagsMap,
      });
    await cloud.setSyncRunDeletions(withPgClient, syncRunId, deletedCount);

    // ========================================================================== //
    // ========================== Project document sync ========================= //
    // ========================================================================== //
    // Documents only need re-syncing for projects that were created/updated
    if (externalProjectIdsToCreateOrUpdate.length > 0) {
      await Promise.all(
        externalProjectIdsToCreateOrUpdate.map(async (externalProjectId) => {
          const localProjectId =
            externalToLocalProjectIdMapping.get(externalProjectId);
          if (!localProjectId) {
            return;
          }
          try {
            await cloud.syncProjectDocument(withPgClient, localProjectId);
            await cloud.bumpSyncRunSyncedProjects(withPgClient, syncRunId!);
          } catch (documentErr) {
            console.error(
              `Failed to sync document for project ${localProjectId}`,
              documentErr,
            );
            await cloud.bumpSyncRunFailedProjects(withPgClient, syncRunId!);
          }
        }),
      );
    }

    // Project phase (categories, tags, meta, documents) is complete
    await cloud.completeSyncRunProjects(withPgClient, syncRunId);

    // Trigger media sync
    await addJob("cloud_connection__sync_media", {
      cloudConnectionId: cloudConnectionId,
      externalProjectIds: allExternalProjectIds,
      force_resync,
      syncRunId,
    });
  } catch (e) {
    console.error(e);
    if (syncRunId) {
      try {
        await cloud.failSyncRun(withPgClient, syncRunId, e);
      } catch (updateErr) {
        console.error("Failed to mark cloud sync run as failed", updateErr);
      }
    }
  }
};

module.exports = task;
