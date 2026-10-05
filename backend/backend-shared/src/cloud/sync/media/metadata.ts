/**
 * The rows that describe media beyond the files themselves. Both sides read
 * and write them with these functions, so what one side sends the other
 * stores as is. Media keep the same id on both sides, so none need mapping.
 */

type Queryable = {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, any>[] }>;
};

export type MediaMetadata = {
  dependencies: { parentMediaId: string; childMediaId: string }[];
  imageSizes: {
    imageMediaId: string;
    processedMediaId: string;
    width: number;
    fileType: string;
  }[];
  imageMetadata: { imageMediaId: string; width: number; height: number }[];
  videoMetadata: {
    videoMediaId: string;
    hlsMediaId: string | null;
    thumbnailMediaId: string | null;
    mp4MediaId: string | null;
    duration: string | null;
    transcodeStatus: string;
  }[];
};

export const emptyMediaMetadata = (): MediaMetadata => ({
  dependencies: [],
  imageSizes: [],
  imageMetadata: [],
  videoMetadata: [],
});

/** Every media id a row refers to; a row is only written where all exist. */
export const mediaIdsOf = {
  dependencies: (r: MediaMetadata["dependencies"][number]) => [
    r.parentMediaId,
    r.childMediaId,
  ],
  imageSizes: (r: MediaMetadata["imageSizes"][number]) => [
    r.imageMediaId,
    r.processedMediaId,
  ],
  imageMetadata: (r: MediaMetadata["imageMetadata"][number]) => [
    r.imageMediaId,
  ],
  videoMetadata: (r: MediaMetadata["videoMetadata"][number]) =>
    [r.videoMediaId, r.hlsMediaId, r.thumbnailMediaId, r.mp4MediaId].filter(
      (id): id is string => id !== null,
    ),
};

/** Keep only rows whose media are all in `present`. */
export const metadataWithin = (
  metadata: MediaMetadata,
  present: Set<string>,
): MediaMetadata => {
  const all = (ids: string[]) => ids.every((id) => present.has(id));
  return {
    dependencies: metadata.dependencies.filter((r) =>
      all(mediaIdsOf.dependencies(r)),
    ),
    imageSizes: metadata.imageSizes.filter((r) =>
      all(mediaIdsOf.imageSizes(r)),
    ),
    imageMetadata: metadata.imageMetadata.filter((r) =>
      all(mediaIdsOf.imageMetadata(r)),
    ),
    videoMetadata: metadata.videoMetadata.filter((r) =>
      all(mediaIdsOf.videoMetadata(r)),
    ),
  };
};

/** The metadata of `mediaIds`, keyed by the media each row describes. */
export const readMediaMetadata = async (
  client: Queryable,
  mediaIds: string[],
): Promise<MediaMetadata> => {
  const {
    rows: [row],
  } = await client.query(
    `
      select
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'parentMediaId', d.parent_media_id,
            'childMediaId', d.child_media_id))
          from app_public.media_dependencies d
          where d.parent_media_id = any($1::uuid[])
        ), '[]'::jsonb) as dependencies,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'imageMediaId', s.image_media_id,
            'processedMediaId', s.processed_media_id,
            'width', s.width,
            'fileType', s.file_type))
          from app_public.media_image_sizes s
          where s.image_media_id = any($1::uuid[])
        ), '[]'::jsonb) as image_sizes,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'imageMediaId', i.image_media_id,
            'width', i.width,
            'height', i.height))
          from app_public.media_image_metadata i
          where i.image_media_id = any($1::uuid[])
        ), '[]'::jsonb) as image_metadata,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'videoMediaId', v.video_media_id,
            'hlsMediaId', v.hls_media_id,
            'thumbnailMediaId', v.thumbnail_media_id,
            'mp4MediaId', v.mp4_media_id,
            'duration', v.duration::text,
            'transcodeStatus', v.transcode_status))
          from app_public.media_video_metadata v
          where v.video_media_id = any($1::uuid[])
        ), '[]'::jsonb) as video_metadata
    `,
    [mediaIds],
  );
  return {
    dependencies: row!.dependencies,
    imageSizes: row!.image_sizes,
    imageMetadata: row!.image_metadata,
    videoMetadata: row!.video_metadata,
  };
};

/**
 * Add the other side's rows. Nothing here is edited by people, so there are
 * no conflicts to resolve, with one exception: a video's transcode, where a
 * completed one is never replaced by one still in progress.
 */
export const writeMediaMetadata = async (
  client: Queryable,
  metadata: MediaMetadata,
): Promise<void> => {
  await client.query(
    `
      insert into app_public.media_dependencies (parent_media_id, child_media_id)
      select "parentMediaId", "childMediaId"
      from jsonb_to_recordset($1::jsonb)
        as x("parentMediaId" uuid, "childMediaId" uuid)
      on conflict do nothing
    `,
    [JSON.stringify(metadata.dependencies)],
  );
  await client.query(
    `
      insert into app_public.media_image_sizes
        (image_media_id, processed_media_id, width, file_type)
      select "imageMediaId", "processedMediaId", width, "fileType"
      from jsonb_to_recordset($1::jsonb) as x(
        "imageMediaId" uuid, "processedMediaId" uuid, width int, "fileType" text
      )
      on conflict do nothing
    `,
    [JSON.stringify(metadata.imageSizes)],
  );
  await client.query(
    `
      insert into app_public.media_image_metadata (image_media_id, width, height)
      select "imageMediaId", width, height
      from jsonb_to_recordset($1::jsonb)
        as x("imageMediaId" uuid, width int, height int)
      on conflict (image_media_id) do update
        set width = excluded.width, height = excluded.height
    `,
    [JSON.stringify(metadata.imageMetadata)],
  );
  await client.query(
    `
      insert into app_public.media_video_metadata as v
        (video_media_id, hls_media_id, thumbnail_media_id, mp4_media_id,
         duration, transcode_status)
      select "videoMediaId", "hlsMediaId", "thumbnailMediaId", "mp4MediaId",
        duration::numeric, "transcodeStatus"::app_public.video_transcode_status
      from jsonb_to_recordset($1::jsonb) as x(
        "videoMediaId" uuid, "hlsMediaId" uuid, "thumbnailMediaId" uuid,
        "mp4MediaId" uuid, duration text, "transcodeStatus" text
      )
      on conflict (video_media_id) do update
        set hls_media_id = excluded.hls_media_id,
            thumbnail_media_id = excluded.thumbnail_media_id,
            mp4_media_id = excluded.mp4_media_id,
            duration = excluded.duration,
            transcode_status = excluded.transcode_status
        where v.transcode_status <> 'completed'
          or excluded.transcode_status = 'completed'
    `,
    [JSON.stringify(metadata.videoMetadata)],
  );
};
