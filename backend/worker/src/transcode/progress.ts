export type TranscodeStatus = "pending" | "processing" | "completed" | "failed";
export type TranscodeStage =
  | "pending"
  | "downloading"
  | "transcoding"
  | "uploading"
  | "finalizing"
  | "completed";

export interface TranscodeProgressUpdate {
  status?: TranscodeStatus;
  progress?: number;
  stage?: TranscodeStage;
  stageProgress?: number;
  currentResolution?: string | null;
  completedResolutions?: string[];
}

export type WithPgClient = (
  callback: (pgClient: any) => Promise<void>,
) => Promise<void>;

export const updateTranscodeProgress = async (
  withPgClient: WithPgClient,
  mediaId: string,
  update: TranscodeProgressUpdate,
) => {
  await withPgClient(async (pgClient) => {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (update.status !== undefined) {
      sets.push(`transcode_status = $${paramIndex++}`);
      values.push(update.status);
    }
    if (update.progress !== undefined) {
      sets.push(`transcode_progress = $${paramIndex++}`);
      values.push(Math.min(100, Math.max(0, Math.round(update.progress))));
    }
    if (update.stage !== undefined) {
      sets.push(`transcode_stage = $${paramIndex++}`);
      values.push(update.stage);
    }
    if (update.stageProgress !== undefined) {
      sets.push(`transcode_stage_progress = $${paramIndex++}`);
      values.push(Math.min(100, Math.max(0, Math.round(update.stageProgress))));
    }
    if (update.currentResolution !== undefined) {
      sets.push(`transcode_current_resolution = $${paramIndex++}`);
      values.push(update.currentResolution);
    }
    if (update.completedResolutions !== undefined) {
      sets.push(`transcode_completed_resolutions = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(update.completedResolutions));
    }

    if (sets.length === 0) return;

    values.push(mediaId);
    await pgClient.query(
      `UPDATE app_public.media_video_metadata 
       SET ${sets.join(", ")} 
       WHERE video_media_id = $${paramIndex}`,
      values,
    );
  });
};
