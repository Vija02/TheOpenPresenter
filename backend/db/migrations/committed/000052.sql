--! Previous: sha1:09bf66c40208ebb530ea92dfb5502acd821171bc
--! Hash: sha1:44fab38489cc6fff0d01078945a7f62abcdce71a

--! split: 100-reset.sql
drop table if exists app_public.media_audio_metadata;

--! split: 300-media-audio-metadata.sql
create table app_public.media_audio_metadata (
  audio_media_id uuid primary key not null references app_public.medias(id) on delete cascade,
  playback_media_id uuid null references app_public.medias(id) on delete set null,
  cover_media_id uuid null references app_public.medias(id) on delete set null,
  duration numeric(10,2) null,
  title text null,
  artist text null,
  album text null,
  -- Optional cause sometimes we don't want to normalize
  normalize_loudness boolean not null default true,
  transcode_status app_public.video_transcode_status not null default 'pending',
  transcode_progress integer not null default 0
);

create index on app_public.media_audio_metadata(playback_media_id);
create index on app_public.media_audio_metadata(cover_media_id);

alter table app_public.media_audio_metadata enable row level security;
create policy select_own_media on app_public.media_audio_metadata for select using (app_public.current_user_can_access_media(audio_media_id));

grant select on app_public.media_audio_metadata to :DATABASE_VISITOR;
