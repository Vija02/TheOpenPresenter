import { cloud } from "@repo/backend-shared";
import {
  AllProjectMetadataDocument,
  AllProjectMetadataQuery,
  AllProjectUpdatedAtDocument,
  AllProjectUpdatedAtQuery,
} from "@repo/graphql";
import { logger } from "@repo/observability";
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
  const payload: CloudConnectionSyncPayload = inPayload as any;
  const { id: cloudConnectionId, force_resync } = payload;

  let log = logger.child({
    task: "cloud_connection__sync",
    cloudConnectionId,
    forceResync: !!force_resync,
  });
  const startedAt = Date.now();
  log.info("Starting cloud connection sync");

  let syncRunId: string | undefined;
  try {
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
      log.error("Cloud connection not found; aborting");
      return;
    }
    if (!cloudConnection.target_organization_slug) {
      log.error("Target organization slug not available; aborting");
      return;
    }

    log.info(
      {
        host: cloudConnection.host,
        targetOrganizationSlug: cloudConnection.target_organization_slug,
        organizationId: cloudConnection.organization_id,
      },
      "Cloud connection loaded",
    );

    // Start tracking
    syncRunId = await cloud.createSyncRun(withPgClient, {
      organizationId: cloudConnection.organization_id,
      cloudConnectionId: cloudConnection.id,
      forceResync: !!force_resync,
    });
    log = log.child({ syncRunId });
    log.info("Created sync run");

    const urqlClient = cloud.getUrqlClientFromCloudConnection(cloudConnection);
    // First, we get the updated_at so we know which ones need to be updated/created
    log.info("Fetching remote project updated_at list");
    const projectUpdatedRes = await urqlClient.query<AllProjectUpdatedAtQuery>(
      AllProjectUpdatedAtDocument,
      {
        slug: cloudConnection.target_organization_slug,
      },
    );
    if (projectUpdatedRes.error) {
      log.error(
        { err: projectUpdatedRes.error },
        "Failed to fetch remote project updated_at list",
      );
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
    log.debug(
      { localProjectCount: localProjects.length },
      "Loaded local projects",
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

    log.info(
      {
        totalRemoteProjects: allExternalProjectIds.length,
        toCreateOrUpdate: externalProjectIdsToCreateOrUpdate.length,
      },
      "Computed projects to create/update",
    );

    log.info("Fetching full project metadata");
    const res = await urqlClient.query<AllProjectMetadataQuery>(
      AllProjectMetadataDocument,
      {
        slug: cloudConnection.target_organization_slug,
        projectIds: externalProjectIdsToCreateOrUpdate,
      },
    );

    if (res.error) {
      log.error({ err: res.error }, "Failed to fetch project metadata");
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
    log.info(
      { requiredCategoryCount: requiredCategories.length },
      "Synced categories",
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
    log.info({ requiredTagCount: requiredTags.length }, "Synced tags");

    // ========================================================================== //
    // ========================= Now handle project meta ======================== //
    // ========================================================================== //
    const externalProjectsToCreateOrUpdate =
      res.data?.organizationBySlug?.projects.nodes.filter((externalProject) =>
        externalProjectIdsToCreateOrUpdate.includes(externalProject.id),
      ) ?? [];
    log.info(
      { projectCount: externalProjectsToCreateOrUpdate.length },
      "Syncing project metadata",
    );
    const {
      mapping: externalToLocalProjectIdMapping,
      deletedCount,
      addedCount,
      updatedCount,
    } = await cloud.syncProjectMeta(withPgClient, {
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
    await cloud.setSyncRunProjectCounts(withPgClient, syncRunId, {
      added: addedCount,
      updated: updatedCount,
    });
    log.info(
      {
        mappedProjectCount: externalToLocalProjectIdMapping.size,
        addedCount,
        updatedCount,
        deletedCount,
      },
      "Synced project metadata",
    );

    // ========================================================================== //
    // ========================== Project document sync ========================= //
    // ========================================================================== //
    // Documents only need re-syncing for projects that were created/updated
    if (externalProjectIdsToCreateOrUpdate.length > 0) {
      log.info(
        { projectCount: externalProjectIdsToCreateOrUpdate.length },
        "Syncing project documents",
      );
      let documentSyncedCount = 0;
      let documentFailedCount = 0;
      await Promise.all(
        externalProjectIdsToCreateOrUpdate.map(async (externalProjectId) => {
          const localProjectId =
            externalToLocalProjectIdMapping.get(externalProjectId);
          if (!localProjectId) {
            log.debug(
              { externalProjectId },
              "Skipping document sync; no local project mapping",
            );
            return;
          }
          try {
            await cloud.syncProjectDocument(withPgClient, localProjectId);
            await cloud.bumpSyncRunSyncedProjects(withPgClient, syncRunId!);
            documentSyncedCount += 1;
            log.debug({ localProjectId }, "Synced project document");
          } catch (documentErr) {
            documentFailedCount += 1;
            log.warn(
              { err: documentErr, localProjectId },
              "Failed to sync document for project",
            );
            await cloud.bumpSyncRunFailedProjects(withPgClient, syncRunId!);
          }
        }),
      );
      log.info(
        { documentSyncedCount, documentFailedCount },
        "Finished syncing project documents",
      );
    }

    // Project phase (categories, tags, meta, documents) is complete
    await cloud.completeSyncRunProjects(withPgClient, syncRunId);
    log.info("Project sync phase complete");

    // Trigger media sync
    await addJob("cloud_connection__sync_media", {
      cloudConnectionId: cloudConnectionId,
      externalProjectIds: allExternalProjectIds,
      force_resync,
      syncRunId,
    });
    log.info(
      {
        externalProjectCount: allExternalProjectIds.length,
        durationMs: Date.now() - startedAt,
      },
      "Enqueued media sync; project sync done",
    );
  } catch (e) {
    log.error(
      { err: e, durationMs: Date.now() - startedAt },
      "Cloud connection sync failed",
    );
    if (syncRunId) {
      try {
        await cloud.failSyncRun(withPgClient, syncRunId, e);
      } catch (updateErr) {
        log.error({ err: updateErr }, "Failed to mark cloud sync run as failed");
      }
    }
  }
};

module.exports = task;
