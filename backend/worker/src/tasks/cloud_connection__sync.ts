import { cloud } from "@repo/backend-shared";
import { logger } from "@repo/observability";
import { Task } from "graphile-worker";

interface CloudConnectionSyncPayload {
  /**
   * request id
   */
  id: string;
  force_resync?: boolean;
}

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

    // ========================================================================== //
    // ===================== @cloudSync tables (incl. plugins) ================== //
    // ========================================================================== //
    // Before projects, so the categories and tags they name exist on both
    // sides. Deletes wait until after: a renamed category is a delete and a
    // create, and the delete would clear it from projects not yet moved over.
    const syncTables = async (deletes: boolean) => {
      try {
        const tableCounts = await cloud.syncPluginTables(
          withPgClient,
          cloudConnection,
          { forceResync: !!force_resync, deletes },
        );
        log.info({ ...tableCounts, deletes }, "Synced @cloudSync tables");
      } catch (tablesErr) {
        log.warn({ err: tablesErr }, "Failed to sync @cloudSync tables");
      }
    };
    await syncTables(false);

    // ========================================================================== //
    // ======================= Projects and their documents ===================== //
    // ========================================================================== //
    const projectCounts = await cloud.syncProjects(
      withPgClient,
      cloudConnection,
      {
        forceResync: !!force_resync,
        onDocumentsPlanned: (plan) =>
          cloud.setSyncRunProjectTargets(withPgClient, syncRunId!, plan),
        onDocumentSynced: (ok) =>
          ok
            ? cloud.bumpSyncRunSyncedProjects(withPgClient, syncRunId!)
            : cloud.bumpSyncRunFailedProjects(withPgClient, syncRunId!),
      },
    );
    const { cloudProjectIds, ...counts } = projectCounts;
    await cloud.setSyncRunDeletions(
      withPgClient,
      syncRunId,
      counts.deletedLocally,
    );
    await cloud.setSyncRunProjectCounts(withPgClient, syncRunId, {
      added: counts.added,
      updated: counts.pulled - counts.added,
    });
    log.info(counts, "Synced projects");

    await syncTables(true);

    // Project phase (tables, projects, documents) is complete
    await cloud.completeSyncRunProjects(withPgClient, syncRunId);
    log.info("Project sync phase complete");

    // Trigger media sync
    await addJob("cloud_connection__sync_media", {
      cloudConnectionId: cloudConnectionId,
      externalProjectIds: cloudProjectIds,
      force_resync,
      syncRunId,
    });
    log.info(
      {
        externalProjectCount: cloudProjectIds.length,
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
        log.error(
          { err: updateErr },
          "Failed to mark cloud sync run as failed",
        );
      }
    }
  }
};

module.exports = task;
