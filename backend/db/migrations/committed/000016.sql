--! Previous: sha1:3b731a54bbf4c88f718e626e42c09b7055b4b1fe
--! Hash: sha1:97fa53fec16853003b364817956be881c700df79

--! split: 100-reset.sql
-- 300
drop table if exists app_public.media_image_metadata;

-- 200
drop table if exists app_public.media_image_sizes;

--! split: 200-image-sizes.sql
-- Create table for storing the metadata of images that has been resized
CREATE TABLE app_public.media_image_sizes (
  image_media_id uuid not null references app_public.medias(id) on delete cascade,
  processed_media_id uuid not null references app_public.medias(id) on delete cascade,
  width int not null,
  file_type text not null
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on "app_public"."media_image_sizes"("image_media_id");
create index on "app_public"."media_image_sizes"("processed_media_id");
create unique index on "app_public"."media_image_sizes"("image_media_id", "width", "file_type");

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.media_image_sizes enable row level security;
-- Policies
create policy select_own_media on app_public.media_image_sizes for select using (app_public.current_user_can_access_media(image_media_id));

-- Grants
grant select on app_public.media_image_sizes to :DATABASE_VISITOR;

--! split: 300-image-metadata.sql
-- Stores metadata of image media
CREATE TABLE app_public.media_image_metadata (
  image_media_id uuid primary key not null references app_public.medias(id) on delete cascade,
  width int not null,
  height int not null
);

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.media_image_metadata enable row level security;
-- Policies
create policy select_own_media on app_public.media_image_metadata for select using (app_public.current_user_can_access_media(image_media_id));

-- Grants
grant select on app_public.media_image_metadata to :DATABASE_VISITOR;
