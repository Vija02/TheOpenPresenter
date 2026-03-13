--! Previous: sha1:4309e7109f6ac5e9de3e2593ded8540d96058a30
--! Hash: sha1:2d99328f6d6e7f9e0d0834b78b1e2a34592724c2

--! split: 1-current.sql
-- Drop types first if they exist, then recreate
drop type if exists app_public.video_transcode_status cascade;
create type app_public.video_transcode_status as enum ('pending', 'processing', 'completed', 'failed');

drop type if exists app_public.video_transcode_stage cascade;
create type app_public.video_transcode_stage as enum ('pending', 'downloading', 'transcoding', 'uploading', 'finalizing', 'completed');

alter table app_public.media_video_metadata
  drop column if exists mp4_media_id,
  drop column if exists transcode_status,
  drop column if exists transcode_progress,
  drop column if exists transcode_current_resolution,
  drop column if exists transcode_stage,
  drop column if exists transcode_stage_progress,
  drop column if exists transcode_completed_resolutions;

alter table app_public.media_video_metadata
  add column mp4_media_id uuid null references app_public.medias(id) on delete set null,
  add column transcode_status app_public.video_transcode_status not null default 'pending',
  add column transcode_progress integer not null default 0,
  add column transcode_current_resolution text null,
  add column transcode_stage app_public.video_transcode_stage not null default 'pending',
  add column transcode_stage_progress integer not null default 0,
  add column transcode_completed_resolutions jsonb not null default '[]'::jsonb;

-- Add indexes
drop index if exists app_public.media_video_metadata_mp4_media_id_idx;
create index media_video_metadata_mp4_media_id_idx on app_public.media_video_metadata(mp4_media_id);
