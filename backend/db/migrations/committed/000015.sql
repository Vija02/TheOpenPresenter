--! Previous: sha1:6b8389e033f770987273557d19ae4ae4d2b38392
--! Hash: sha1:3b731a54bbf4c88f718e626e42c09b7055b4b1fe

--! split: 100-reset.sql
-- 200
drop table if exists app_public.media_video_metadata;

--! split: 200-current.sql
-- Create table for storing video metadata
CREATE TABLE app_public.media_video_metadata (
  video_media_id uuid primary key not null references app_public.medias(id) on delete cascade,
  hls_media_id uuid null references app_public.medias(id) on delete set null,
  thumbnail_media_id uuid null references app_public.medias(id) on delete set null,
  duration numeric(10,2) null
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on "app_public"."media_video_metadata"("hls_media_id");
create index on "app_public"."media_video_metadata"("thumbnail_media_id");

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.media_video_metadata enable row level security;
-- Policies
create policy select_own_media on app_public.media_video_metadata for select using (app_public.current_user_can_access_media(video_media_id));

-- Grants
grant select on app_public.media_video_metadata to :DATABASE_VISITOR;
