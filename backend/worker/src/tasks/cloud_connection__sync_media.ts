import { cloud, media } from "@repo/backend-shared";
import {
  ProjectMediaInfoDocument,
  ProjectMediaInfoQuery,
  ProjectMediasDocument,
  ProjectMediasQuery,
} from "@repo/graphql";
import { extractMediaName, resolveMediaUrl } from "@repo/lib";
import { logger } from "@repo/observability";
import { http, https } from "follow-redirects";
import { Task } from "graphile-worker";

interface CloudConnectionSyncMediaPayload {
  cloudConnectionId: string;
  externalProjectIds: string[];
  force_resync?: boolean;
}

/**
 * DEBT: Currently we can't have 2 same media in the device. At least it won't be attributed to the correct organization
 * In practice, this shouldn't happen as each media should be scoped to an organization
 * But if a user were to sync between 2 organization in the same system, this would hit
 */
const task: Task = async (inPayload, { addJob, withPgClient }) => {
  try {
    const payload: CloudConnectionSyncMediaPayload = inPayload as any;
    // TODO: Handle force in an idempotent way
    // Maybe make the record, don't finish upload. And then finish & complete it -- separate task?
    const { cloudConnectionId, externalProjectIds, force_resync } = payload;
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

    // Get all the medias from the project ids
    const urqlClient = cloud.getUrqlClientFromCloudConnection(cloudConnection);
    const projectMediasRes = await urqlClient.query<ProjectMediasQuery>(
      ProjectMediasDocument,
      {
        projectIds: externalProjectIds,
      },
    );
    if (projectMediasRes.error) {
      throw projectMediasRes.error;
    }

    const allMediaIds = projectMediasRes.data?.allMediaOfProjects?.map(
      (x) => x?.id,
    );

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

    const mediaIdsToAdd = allMediaIds?.filter(
      (x) => !localMediaIds.includes(x),
    );

    const mediasToAdd =
      projectMediasRes.data?.allMediaOfProjects?.filter((x) =>
        mediaIdsToAdd?.includes(x?.id),
      ) ?? [];

    await withPgClient(async (pgClient) => {
      const mediaHandler = new media[
        process.env.STORAGE_TYPE as "file" | "s3"
      ].mediaHandler(pgClient);

      // TODO: Do this in an easier to retry fashion?
      // Make sure it's idempotent. Maybe need to handle partially uploaded file
      await Promise.all(
        mediasToAdd.map((media) => {
          const { mediaId, extension } = extractMediaName(
            media?.mediaName ?? "",
          );
          const module =
            new URL(cloudConnection.host).protocol === "https:" ? https : http;

          return module.get(
            resolveMediaUrl({
              mediaId,
              extension,
              host: cloudConnection.host,
            }),
            (stream) => {
              return mediaHandler.uploadMedia({
                file: stream,
                fileExtension: media?.fileExtension,
                fileSize: media?.fileSize,
                // Attach to the user who created the cloud connection
                userId: cloudConnection.creator_user_id,
                organizationId: cloudConnection.organization_id,
                creationDate: media?.createdAt,
                mediaId,
                originalFileName: media?.originalName,
                isUserUploaded: media?.isUserUploaded,
              });
            },
          );
        }),
      );
    });

    // Now let's get all the metadata so we can sync them too
    const projectMediaInfoRes = await urqlClient.query<ProjectMediaInfoQuery>(
      ProjectMediaInfoDocument,
      {
        mediaIds: projectMediasRes.data?.allMediaOfProjects?.map((x) => x?.id),
      },
    );
    if (projectMediaInfoRes.error) {
      throw projectMediaInfoRes.error;
    }

    // We only need to sync one way

    // Sync media dependencies
    await withPgClient((pgClient) =>
      pgClient.query(
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
      ),
    );
    // Sync media image sizes
    await withPgClient((pgClient) =>
      pgClient.query(
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
      ),
    );
    // Sync media video metadata
    await withPgClient((pgClient) =>
      pgClient.query(
        `
          INSERT INTO app_public.media_video_metadata(video_media_id, hls_media_id, thumbnail_media_id, duration) 
            SELECT video_media_id, hls_media_id, thumbnail_media_id, duration
              FROM jsonb_to_recordset($1) AS t (video_media_id uuid, hls_media_id uuid, thumbnail_media_id uuid, duration numeric)
            ON CONFLICT DO NOTHING;
        `,
        [
          JSON.stringify(
            projectMediaInfoRes.data?.mediaVideoMetadata?.nodes.map((x) => ({
              video_media_id: x.videoMediaId,
              hls_media_id: x.hlsMediaId,
              thumbnail_media_id: x.thumbnailMediaId,
              duration: x.duration,
            })),
          ),
        ],
      ),
    );
    // Sync project media
    await withPgClient((pgClient) =>
      pgClient.query(
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
      ),
    );
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
      await withPgClient(async (pgClient) => {
        // Find user-uploaded media that aren't being used in any projects
        const { rows: mediaIdsToActuallyDelete } = await pgClient.query(
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

        if (mediaIdsToActuallyDelete.length > 0) {
          const mediaHandler = new media[
            process.env.STORAGE_TYPE as "file" | "s3"
          ].mediaHandler(pgClient);

          await Promise.all(
            mediaIdsToActuallyDelete.map(async (row) => {
              try {
                await mediaHandler.deleteMedia(row.media_name);
              } catch (error) {
                logger.error(
                  { error, id: row.id },
                  "Failed to delete media from media sync",
                );
                console.error(`Sync: Failed to delete media ${row.id}:`, error);
              }
            }),
          );
        }
      });
    }
    // TODO: Media video
  } catch (e) {
    console.error(e);
    // TODO: Update job status on error
  }
};

module.exports = task;
