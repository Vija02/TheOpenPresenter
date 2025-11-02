--! Previous: sha1:47794e272808862d0295cdb52a0deffa65c88e30
--! Hash: sha1:44f109ffe59b6c3bd1e9610b53f3926cdfa215cc

--! split: 100-reset.sql
-- 400 
drop function if exists app_private.tg_tasks__update_project_updated_at() cascade;

-- 300
ALTER TABLE app_public.projects
  DROP COLUMN IF EXISTS cloud_connection_id,
  DROP COLUMN IF EXISTS cloud_last_updated,
  DROP COLUMN IF EXISTS cloud_should_sync,
  DROP COLUMN IF EXISTS cloud_project_id;

-- 200
drop table if exists app_public.cloud_connections;

--! split: 200-cloud-connection.sql
-- Create table for cloud connections
create table app_public.cloud_connections (
  id uuid primary key default uuid_generate_v7(),
  organization_id uuid not null references app_public.organizations(id) on delete cascade,

  host text not null,
  session_cookie text not null,
  session_cookie_expiry timestamptz not null,

  target_organization_slug text null,

  sync_all boolean default false,

  creator_user_id uuid null references app_public.users("id") on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on "app_public"."cloud_connections"("organization_id");
create index on "app_public"."cloud_connections"("creator_user_id");
create index on "app_public"."cloud_connections"("created_at");

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.cloud_connections
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.cloud_connections enable row level security;
-- Policies
create policy select_own on app_public.cloud_connections for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on app_public.cloud_connections for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_only_when_empty on app_public.cloud_connections for update using (target_organization_slug is null);
create policy delete_own on app_public.cloud_connections for delete using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.cloud_connections to :DATABASE_VISITOR;
grant update(target_organization_slug) on app_public.cloud_connections to :DATABASE_VISITOR;
grant delete on app_public.cloud_connections to :DATABASE_VISITOR;

--! split: 300-project-cloud.sql
ALTER TABLE app_public.projects
  ADD COLUMN cloud_connection_id uuid null,
  ADD COLUMN cloud_last_updated timestamptz null,
  ADD COLUMN cloud_should_sync boolean null,
  ADD COLUMN cloud_project_id uuid null;

create index on "app_public"."projects"("cloud_connection_id");
create unique index on "app_public"."projects"("organization_id", "cloud_project_id");

--! split: 400-project-tags-updated-at.sql
/*
 * Updates the specified project updated_at column
 */
create function app_private.tg_tasks__update_project_updated_at() returns trigger as $$
begin
  update app_public.projects
  set
    updated_at = now()
  where id = COALESCE(NEW.project_id, OLD.project_id);
  
  return null;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;
comment on function app_private.tg_tasks__update_project_updated_at() is
  E'This trigger should be attached to all entity that is connected to a project. We use this to update the updated_at field in a project';

create trigger _300_update_project_updated_at after insert or update or delete on app_public.project_tags for each row execute procedure app_private.tg_tasks__update_project_updated_at();

--! split: 500-fix-project-category-on-delete.sql
alter table app_public.projects drop constraint projects_category_id_fkey;

ALTER TABLE ONLY app_public.projects
  ADD CONSTRAINT projects_category_id_fkey FOREIGN KEY (category_id) REFERENCES app_public.categories(id) ON DELETE SET NULL;
