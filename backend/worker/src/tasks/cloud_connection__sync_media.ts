import { cloud, media } from "@repo/backend-shared";
import {
  AllMediaDocument,
  AllMediaQuery,
  ProjectMediaInfoDocument,
  ProjectMediaInfoQuery,
} from "@repo/graphql";
import { extractMediaName, resolveMediaUrl } from "@repo/lib";
import { logger } from "@repo/observability";
import { http, https } from "follow-redirects";
import { Task, WithPgClient } from "graphile-worker";
import { Transform } from "node:stream";
import pLimit from "p-limit";

interface CloudConnectionSyncMediaPayload {
  cloudConnectionId: string;
  externalProjectIds: string[];
  force_resync?: boolean;
  syncRunId?: string;
}

const MEDIA_UPLOAD_CONCURRENCY =
  (process.env.STORAGE_TYPE as "file" | "s3") === "file" ? 20 : 5;

const setMediaStatus = async (
  withPgClient: WithPgClient,
  syncRunId: string | undefined,
  status: "syncing" | "synced" | "failed",
) => {
  if (!syncRunId) {
    return;
  }
  try {
    await cloud.setSyncRunMediaStatus(withPgClient, syncRunId, status);
  } catch (e) {
    console.error("Failed to update cloud sync media status", e);
  }
};

/**
 * DEBT: Currently we can't have 2 same media in the device. At least it won't be attributed to the correct organization
 * In practice, this shouldn't happen as each media should be scoped to an organization
 * But if a user were to sync between 2 organization in the same system, this would hit
 */
const task: Task = async (inPayload, { addJob, withPgClient }) => {
  const payload: CloudConnectionSyncMediaPayload = inPayload as any;
  // TODO: Handle force in an idempotent way
  // Maybe make the record, don't finish upload. And then finish & complete it -- separate task?
  const { cloudConnectionId, externalProjectIds, force_resync, syncRunId } =
    payload;
  try {
    await setMediaStatus(withPgClient, syncRunId, "syncing");

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
      await setMediaStatus(withPgClient, syncRunId, "failed");
      return;
    }
    if (!cloudConnection.target_organization_slug) {
      console.error("Target organization slug not available; aborting");
      await setMediaStatus(withPgClient, syncRunId, "failed");
      return;
    }

    const urqlClient = cloud.getUrqlClientFromCloudConnection(cloudConnection);

    type AllMediaNode = NonNullable<
      NonNullable<
        NonNullable<AllMediaQuery["organizationBySlug"]>["medias"]
      >["nodes"][number]
    >;
    const allMedias: AllMediaNode[] = [];
    let after: string | null | undefined = undefined;
    do {
      const allMediaRes = await urqlClient.query<AllMediaQuery>(
        AllMediaDocument,
        {
          slug: cloudConnection.target_organization_slug,
          first: 500,
          after,
        },
      );
      if (allMediaRes.error) {
        throw allMediaRes.error;
      }
      const connection = allMediaRes.data?.organizationBySlug?.medias;
      for (const node of connection?.nodes ?? []) {
        if (node) {
          allMedias.push(node);
        }
      }
      const next = connection?.pageInfo.hasNextPage
        ? connection?.pageInfo.endCursor
        : undefined;
      after = next as any;
    } while (after);

    const allMediaIds = allMedias.map((x) => x.id);

    const { rows: localMediaIdRows } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          select id
          from app_public.medias
          where id = ANY($1)
        `,
        [allMediaIds],
      ),
    );
    const localMediaIds = localMediaIdRows.map((x) => x.id);

    const mediaIdsToAdd = allMediaIds.filter((x) => !localMediaIds.includes(x));

    const mediasToAdd = allMedias.filter((x) => mediaIdsToAdd.includes(x.id));

    const mediaHandler = new media[
      process.env.STORAGE_TYPE as "file" | "s3"
    ].mediaHandler(withPgClient);

    // Record media progress totals
    const totalBytes = mediasToAdd.reduce(
      (sum, m) => sum + Number(m?.fileSize ?? 0),
      0,
    );
    if (syncRunId) {
      await withPgClient((pgClient) =>
        pgClient.query(
          `
            UPDATE app_public.cloud_sync_runs
              SET total_media = $2, synced_media = 0,
                  total_bytes = $3, downloaded_bytes = 0
              WHERE id = $1
          `,
          [syncRunId, mediasToAdd.length, totalBytes],
        ),
      );
    }

    // Track bytes downloaded across all files. Flushed to the DB on a timer
    // (not per-chunk) so progress stays smooth without hammering Postgres.
    let downloadedBytes = 0;
    const flushDownloadedBytes = async () => {
      if (!syncRunId) return;
      try {
        await withPgClient((pgClient) =>
          pgClient.query(
            `UPDATE app_public.cloud_sync_runs SET downloaded_bytes = $2 WHERE id = $1`,
            [syncRunId, downloadedBytes],
          ),
        );
      } catch (e) {
        console.error("Failed to update downloaded bytes", e);
      }
    };
    const flushInterval = syncRunId
      ? setInterval(() => {
          void flushDownloadedBytes();
        }, 1500)
      : null;

    // TODO: Do this in an easier to retry fashion?
    // Make sure it's idempotent. Maybe need to handle partially uploaded file
    const limit = pLimit(MEDIA_UPLOAD_CONCURRENCY);
    try {
      await Promise.all(
        mediasToAdd.map((media) =>
          limit(() => {
            const { mediaId, extension } = extractMediaName(
              media?.mediaName ?? "",
            );
            const module =
              new URL(cloudConnection.host).protocol === "https:"
                ? https
                : http;

            return new Promise<void>((resolve, reject) => {
              const request = module.get(
                resolveMediaUrl({
                  mediaId,
                  extension,
                  host: cloudConnection.host,
                }),
                (stream) => {
                  // Count bytes as they flow through, independent of how the
                  // uploader consumes the stream.
                  const counter = new Transform({
                    transform(chunk, _enc, cb) {
                      downloadedBytes += chunk.length;
                      cb(null, chunk);
                    },
                  });
                  stream.on("error", reject);
                  const countedStream = stream.pipe(counter);
                  Promise.resolve(
                    mediaHandler.uploadMedia({
                      file: countedStream,
                      fileExtension: media?.fileExtension,
                      fileSize: media?.fileSize,
                      // Attach to the user who created the cloud connection
                      userId: cloudConnection.creator_user_id,
                      organizationId: cloudConnection.organization_id,
                      creationDate: media?.createdAt,
                      mediaId,
                      originalFileName: media?.originalName,
                      isUserUploaded: media?.isUserUploaded,
                      // Don't reprocess
                      skipProcessing: true,
                    }),
                  )
                    .then(async () => {
                      // Atomic increment so concurrent uploads don't clobber each other
                      if (syncRunId) {
                        await withPgClient((pgClient) =>
                          pgClient.query(
                            `
                          UPDATE app_public.cloud_sync_runs
                            SET synced_media = synced_media + 1
                            WHERE id = $1
                        `,
                            [syncRunId],
                          ),
                        );
                      }
                      resolve();
                    })
                    .catch(reject);
                },
              );
              request.on("error", reject);
            });
          }),
        ),
      );
    } finally {
      if (flushInterval) clearInterval(flushInterval);
      await flushDownloadedBytes();
    }

    // Now let's get all the metadata so we can sync them too
    const projectMediaInfoRes = await urqlClient.query<ProjectMediaInfoQuery>(
      ProjectMediaInfoDocument,
      {
        mediaIds: allMediaIds,
      },
    );
    if (projectMediaInfoRes.error) {
      throw projectMediaInfoRes.error;
    }

    // We only need to sync one way.
    //
    // Sync all four metadata tables atomically so a partial failure can't
    // leave dependencies pointing at media that lacks video/image metadata,
    // or project_medias referencing media whose dependency graph is missing.
    await media.withTransaction(withPgClient, async (client) => {
      // Sync media dependencies
      await client.query(
        `
          INSERT INTO app_public.media_dependencies(parent_media_id, child_media_id)
            SELECT parent_media_id, child_media_id
              FROM jsonb_to_recordset($1) AS t (parent_media_id uuid, child_media_id uuid)
            ON CONFLICT DO NOTHING;
        `,
        [
          JSON.stringify(
            projectMediaInfoRes.data?.mediaDependencies?.nodes.map((x) => ({
              parent_media_id: x.parentMediaId,
              child_media_id: x.childMediaId,
            })),
          ),
        ],
      );
      // Sync media image sizes
      await client.query(
        `
          INSERT INTO app_public.media_image_sizes(image_media_id, processed_media_id, width, file_type)
            SELECT image_media_id, processed_media_id, width, file_type
              FROM jsonb_to_recordset($1) AS t (image_media_id uuid, processed_media_id uuid, width int, file_type text)
            ON CONFLICT DO NOTHING;
        `,
        [
          JSON.stringify(
            projectMediaInfoRes.data?.mediaImageSizes?.nodes.map((x) => ({
              image_media_id: x.imageMediaId,
              processed_media_id: x.processedMediaId,
              width: x.width,
              file_type: x.fileType,
            })),
          ),
        ],
      );

      // Sync media image metadata (width/height)
      await client.query(
        `
          INSERT INTO app_public.media_image_metadata(image_media_id, width, height)
            SELECT image_media_id, width, height
              FROM jsonb_to_recordset($1) AS t (image_media_id uuid, width int, height int)
            ON CONFLICT (image_media_id) DO UPDATE SET
              width = excluded.width,
              height = excluded.height;
        `,
        [
          JSON.stringify(
            projectMediaInfoRes.data?.mediaImageMetadata?.nodes.map((x) => ({
              image_media_id: x.imageMediaId,
              width: x.width,
              height: x.height,
            })),
          ),
        ],
      );

      // Sync media video metadata
      await client.query(
        `
          INSERT INTO app_public.media_video_metadata(video_media_id, hls_media_id, thumbnail_media_id, duration, transcode_status)
            SELECT video_media_id, hls_media_id, thumbnail_media_id, duration, transcode_status
              FROM jsonb_to_recordset($1) AS t (video_media_id uuid, hls_media_id uuid, thumbnail_media_id uuid, duration numeric, transcode_status app_public.video_transcode_status)
            ON CONFLICT (video_media_id) DO UPDATE SET
              hls_media_id = excluded.hls_media_id,
              thumbnail_media_id = excluded.thumbnail_media_id,
              duration = excluded.duration,
              transcode_status = excluded.transcode_status;
        `,
        [
          JSON.stringify(
            projectMediaInfoRes.data?.mediaVideoMetadata?.nodes.map((x) => ({
              video_media_id: x.videoMediaId,
              hls_media_id: x.hlsMediaId,
              thumbnail_media_id: x.thumbnailMediaId,
              duration: x.duration,
              transcode_status: String(
                x.transcodeStatus ?? "COMPLETED",
              ).toLowerCase(),
            })),
          ),
        ],
      );

      // Sync project media
      await client.query(
        `
          INSERT INTO app_public.project_medias(project_id, media_id, plugin_id)
            SELECT
              p.id AS project_id,
              t.media_id,
              t.plugin_id
            FROM jsonb_to_recordset($1) AS t (cloud_project_id uuid, media_id uuid, plugin_id uuid)
            JOIN app_public.projects p ON p.cloud_project_id = t.cloud_project_id
          ON CONFLICT DO NOTHING;
        `,
        [
          JSON.stringify(
            projectMediaInfoRes.data?.projectMedias?.nodes.map(
              (externalProjectMedia) => ({
                cloud_project_id: externalProjectMedia.projectId,
                media_id: externalProjectMedia.mediaId,
                plugin_id: externalProjectMedia.pluginId,
              }),
            ),
          ),
        ],
      );
    });
    // Sync deletion
    const { rows: localProjectMedias } = await withPgClient((pgClient) =>
      pgClient.query(
        `
          SELECT pm.project_id, pm.media_id, pm.plugin_id
          FROM app_public.project_medias pm
          JOIN app_public.projects p ON pm.project_id = p.id
          WHERE p.cloud_project_id = ANY($1)
        `,
        [externalProjectIds],
      ),
    );

    const externalProjectMedias =
      projectMediaInfoRes.data?.projectMedias?.nodes || [];

    // Find project_medias that exist locally but not externally
    const projectMediasToDelete = localProjectMedias.filter((localPM) => {
      return !externalProjectMedias.some(
        (externalPM) =>
          externalPM.projectId === localPM.project_id &&
          externalPM.mediaId === localPM.media_id &&
          externalPM.pluginId === localPM.plugin_id,
      );
    });

    if (projectMediasToDelete.length > 0) {
      await withPgClient((pgClient) =>
        pgClient.query(
          `
            DELETE FROM app_public.project_medias
            WHERE (project_id, media_id, plugin_id) IN (
              SELECT project_id, media_id, plugin_id
              FROM jsonb_to_recordset($1) AS t (project_id uuid, media_id uuid, plugin_id uuid)
            )
          `,
          [
            JSON.stringify(
              projectMediasToDelete.map((pm) => ({
                project_id: pm.project_id,
                media_id: pm.media_id,
                plugin_id: pm.plugin_id,
              })),
            ),
          ],
        ),
      );
    }

    /**
     * Delete removed medias
     *
     * We only need to handle deletion of user uploaded media.
     * System media are attached to projects. So if the projects are synced, we shouldn't need to do anything else
     * This should primarily happen when the user deletes the media from the media library explicitly
     *
     * But, we also do NOT want to remove it if it's now being used somewhere else. This is a de-sync but is expected.
     */
    // This deletion should happen after the project_medias table has been synced
    // This will ensure we check it properly
    const mediaIdsToDelete = localMediaIds.filter(
      (localMediaId) => !allMediaIds?.includes(localMediaId),
    );
    if (mediaIdsToDelete.length > 0) {
      // Find user-uploaded media that aren't being used in any projects
      const mediaIdsToActuallyDelete = await withPgClient(async (pgClient) => {
        const { rows } = await pgClient.query(
          `
            SELECT m.id, m.media_name
            FROM app_public.medias m
            LEFT JOIN app_public.project_medias pm ON m.id = pm.media_id
            WHERE m.id = ANY($1)
              AND m.is_user_uploaded = true
              AND pm.media_id IS NULL
          `,
          [mediaIdsToDelete],
        );
        return rows;
      });

      if (mediaIdsToActuallyDelete.length > 0) {
        const mediaHandler = new media[
          process.env.STORAGE_TYPE as "file" | "s3"
        ].mediaHandler(withPgClient);

        await Promise.all(
          mediaIdsToActuallyDelete.map(async (row) => {
            try {
              await mediaHandler.deleteMedia(row.media_name);
            } catch (err) {
              logger.error(
                { err, id: row.id },
                "Failed to delete media from media sync",
              );
              console.error(`Sync: Failed to delete media ${row.id}:`, err);
            }
          }),
        );
      }
    }

    await setMediaStatus(withPgClient, syncRunId, "synced");
  } catch (e) {
    console.error(e);
    await setMediaStatus(withPgClient, syncRunId, "failed");
  }
};

module.exports = task;
