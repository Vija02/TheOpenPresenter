import { SUPPORTED_AUDIO_EXTENSIONS } from "@repo/lib";
import { logger } from "@repo/observability";
import { Task } from "graphile-worker";

interface MediasQueueMissingAudioTranscodesPayload {
  /** Leaves recent uploads to the upload path, which knows their loudness setting */
  minAgeSeconds?: number;
}

/**
 * Audio uploaded before audio processing existed has no metadata row,
 * so the media picker shows it as processing forever.
 * Old audio keeps its levels, the same as a recording
 */
const task: Task = async (inPayload, { withPgClient }) => {
  const { minAgeSeconds = 0 } =
    (inPayload as MediasQueueMissingAudioTranscodesPayload | undefined) ?? {};

  const { rowCount } = await withPgClient((client) =>
    client.query(
      `
        with inserted as (
          insert into app_public.media_audio_metadata (audio_media_id, normalize_loudness)
          select m.id, false
          from app_public.medias m
          where m.is_user_uploaded
            and m.is_complete
            and lower(m.file_extension) = any($1::text[])
            and m.updated_at < now() - make_interval(secs => $2)
          on conflict (audio_media_id) do nothing
          returning audio_media_id
        )
        select graphile_worker.add_job(
          'medias__transcodeAudio',
          payload := json_build_object('id', audio_media_id),
          queue_name := 'audio_transcode_' || audio_media_id,
          job_key := 'audio_transcode_' || audio_media_id
        )
        from inserted
      `,
      [SUPPORTED_AUDIO_EXTENSIONS.map((ext) => ext.slice(1)), minAgeSeconds],
    ),
  );

  if (rowCount) {
    logger.info({ count: rowCount }, "Queued audio with no metadata");
  }
};

module.exports = task;
