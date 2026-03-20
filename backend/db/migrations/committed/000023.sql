--! Previous: sha1:2d99328f6d6e7f9e0d0834b78b1e2a34592724c2
--! Hash: sha1:d40d767485057f0a32f90e0d379df873eeab1d83

--! split: 1-current.sql
-- Update existing video metadata records to mark transcoding as completed
-- This is for old data that was uploaded before the transcode tracking columns were added
-- These videos already have their HLS/thumbnail generated, so they should be marked as completed

update app_public.media_video_metadata
set
  transcode_status = 'completed',
  transcode_progress = 100,
  transcode_stage = 'completed',
  transcode_stage_progress = 100
where
  transcode_status = 'pending'
  and hls_media_id is not null;
