--! Previous: sha1:22d6f0e6079ae640d4de8e1a38b565878a3d8345
--! Hash: sha1:6b8389e033f770987273557d19ae4ae4d2b38392

--! split: 100-reset.sql
-- 400
drop trigger if exists _200_forbid_if_medias_within_different_org on app_public.media_dependencies cascade;
drop function if exists app_private.tg_media_dependencies__forbid_if_medias_within_different_org() cascade;
drop table if exists app_public.media_dependencies;

-- 300
drop function if exists app_public.current_user_can_access_media(uuid) cascade;

-- 200
drop index if exists medias_is_user_uploaded_idx;
ALTER TABLE app_public.medias
  DROP COLUMN IF EXISTS is_user_uploaded;

--! split: 200-media-user-uploaded.sql
ALTER TABLE app_public.medias
  ADD COLUMN is_user_uploaded boolean not null default true;

create index on "app_public"."medias"("is_user_uploaded");

--! split: 300-media-permission.sql
create function app_public.current_user_can_access_media(media_id uuid) returns boolean as $$
  select exists(select 1 from app_public.medias where id = media_id and organization_id in (select app_public.current_user_member_organization_ids()));
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

--! split: 400-media-dependencies.sql
-- Create table for dependency
CREATE TABLE app_public.media_dependencies (
  parent_media_id uuid not null references app_public.medias(id) on delete cascade,
  child_media_id uuid not null references app_public.medias(id) on delete cascade
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on "app_public"."media_dependencies"("parent_media_id");
create index on "app_public"."media_dependencies"("child_media_id");
create unique index on "app_public"."media_dependencies"("parent_media_id", "child_media_id");

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.media_dependencies enable row level security;
-- Policies
create policy select_own_org on app_public.media_dependencies for select using (app_public.current_user_can_access_media(parent_media_id));
create policy insert_own_org on app_public.media_dependencies for insert with check (app_public.current_user_can_access_media(parent_media_id));
create policy delete_own_org on app_public.media_dependencies for delete using (app_public.current_user_can_access_media(parent_media_id));

-- Grants
grant select on app_public.media_dependencies to :DATABASE_VISITOR;
grant insert(parent_media_id, child_media_id) on app_public.media_dependencies to :DATABASE_VISITOR;
-- No need to update
grant delete on app_public.media_dependencies to :DATABASE_VISITOR;

/*====================================*/
/*============ Constraints ===========*/
/*====================================*/
create function app_private.tg_media_dependencies__forbid_if_medias_within_different_org() returns trigger as $$
declare
  v_parent_org_id uuid;
  v_child_org_id uuid;
begin
  select organization_id into v_parent_org_id from app_public.medias where id = NEW.parent_media_id;
  select organization_id into v_child_org_id from app_public.medias where id = NEW.child_media_id;

  if (v_parent_org_id <> v_child_org_id) then
    raise exception 'Cannot create this media dependency relation' using errcode='TGOCT';
  end if;
  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

create trigger _200_forbid_if_medias_within_different_org before insert or update on app_public.media_dependencies for each row execute procedure app_private.tg_media_dependencies__forbid_if_medias_within_different_org();
