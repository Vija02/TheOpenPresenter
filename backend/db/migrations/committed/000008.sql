--! Previous: sha1:2aa6f37747ace9959253ab1d8b25fbd1757272df
--! Hash: sha1:560a00d05700fa9a7b21c7eb0c09fd1b188dac63

--! split: 100-drop.sql
-- 700
drop policy if exists update_own_org on app_public.projects;
drop policy if exists delete_own_org on app_public.projects;
drop function if exists app_public.create_full_project(uuid, text, text, uuid[], uuid, timestamptz) cascade;

-- 600
drop trigger if exists _200_forbid_if_category_is_not_same_org on app_public.projects cascade;
drop function if exists app_private.tg_projects__forbid_if_category_is_not_same_org() cascade;
ALTER TABLE app_public.projects
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS target_date,
  DROP COLUMN IF EXISTS category_id;

-- 550
drop trigger if exists _200_create_default_category on app_public.organizations cascade;
drop function if exists app_private.tg_organizations__create_default_category() cascade;

-- 500
drop function if exists app_public.current_user_can_access_category(uuid) cascade;
drop table if exists app_public.categories;

-- 400
drop function if exists app_private.tg_project_tags__forbid_if_project_and_tag_within_different_org() cascade;
drop table if exists app_public.project_tags;

-- 300
drop function if exists app_public.current_user_can_access_tag(uuid) cascade;
drop table if exists app_public.tags;

-- 200
drop function if exists app_public.current_user_can_access_project(uuid) cascade;

--! split: 200-project-access.sql
create function app_public.current_user_can_access_project(project_id uuid) returns boolean as $$
  select exists(select 1 from app_public.projects where id = project_id and organization_id in (select app_public.current_user_member_organization_ids()));
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

--! split: 300-tags.sql
CREATE TABLE app_public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  background_color text default '',
  foreground_color text default '',
  variant text default '',
  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on "app_public"."tags"("organization_id");
create unique index on "app_public"."tags"("name", "organization_id");

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.tags
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.tags enable row level security;
-- Policies
create policy select_own_org on app_public.tags for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on app_public.tags for insert with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on app_public.tags for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on app_public.tags for delete using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.tags to :DATABASE_VISITOR;
grant insert(name, description, background_color, foreground_color, variant, organization_id) on app_public.tags to :DATABASE_VISITOR;
grant update(name, description, background_color, foreground_color, variant) on app_public.tags to :DATABASE_VISITOR;
grant delete on app_public.tags to :DATABASE_VISITOR;

/*====================================*/
/*============= Comments =============*/
/*====================================*/
comment on table app_public.tags is
  E'Tag data';

/*
 * Checks the organization id is owned by the user
 */
create function app_public.current_user_can_access_tag(tag_id uuid) returns boolean as $$
  select exists(select 1 from app_public.tags where id = tag_id and organization_id in (select app_public.current_user_member_organization_ids()));
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

--! split: 400-project-tags.sql
create table app_public.project_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references app_public.projects(id) on delete cascade,
  tag_id uuid not null references app_public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on "app_public"."project_tags"("project_id");
create index on "app_public"."project_tags"("tag_id");
create unique index on "app_public"."project_tags"("project_id", "tag_id");

/*====================================*/
/*========== Common Triggers =========*/
/*====================================*/
create trigger _100_timestamps
  before insert or update on app_public.project_tags
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.project_tags enable row level security;
-- Policies
create policy select_own on app_public.project_tags for select using (app_public.current_user_can_access_project(project_id));

create policy insert_own_project on app_public.project_tags for insert with check (app_public.current_user_can_access_project(project_id));
create policy insert_own_tag on app_public.project_tags for insert with check (app_public.current_user_can_access_tag(tag_id));

-- No need to update

create policy delete_own on app_public.project_tags for delete using (app_public.current_user_can_access_project(project_id));

-- Grants
grant select on app_public.project_tags to :DATABASE_VISITOR;
grant insert(project_id, tag_id) on app_public.project_tags to :DATABASE_VISITOR;
-- No need to update
grant delete on app_public.project_tags to :DATABASE_VISITOR;

/*====================================*/
/*============ Constraints ===========*/
/*====================================*/
create function app_private.tg_project_tags__forbid_if_project_and_tag_within_different_org() returns trigger as $$
declare
  v_tag_org_id uuid;
  v_project_org_id uuid;
begin
  select organization_id into v_tag_org_id from app_public.tags where id = NEW.tag_id;
  select
    organization_id into v_project_org_id
  from
    app_public.projects as p
  where
    p.id = NEW.project_id;

  if (v_tag_org_id <> v_project_org_id) then
    raise exception 'Cannot create this tag-project relation' using errcode='TGOCT';
  end if;
  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

create trigger _200_forbid_if_project_and_tag_within_different_org before insert or update on app_public.project_tags for each row execute procedure app_private.tg_project_tags__forbid_if_project_and_tag_within_different_org();

/*====================================*/
/*============= Comments =============*/
/*====================================*/
comment on table app_public.project_tags is
  E'Many to many relation from project to tag';

--! split: 500-categories.sql
CREATE TABLE app_public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on "app_public"."categories"("organization_id");
create unique index on "app_public"."categories"("name", "organization_id");

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.categories
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.categories enable row level security;
-- Policies
create policy select_own_org on app_public.categories for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on app_public.categories for insert with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on app_public.categories for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on app_public.categories for delete using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.categories to :DATABASE_VISITOR;
grant insert(name, organization_id) on app_public.categories to :DATABASE_VISITOR;
grant update(name) on app_public.categories to :DATABASE_VISITOR;
grant delete on app_public.categories to :DATABASE_VISITOR;

/*====================================*/
/*============= Comments =============*/
/*====================================*/
comment on table app_public.categories is
  E'Categories data';

/*
 * Checks the organization id is owned by the user
 */
create function app_public.current_user_can_access_category(category_id uuid) returns boolean as $$
  select exists(select 1 from app_public.categories where id = category_id and organization_id in (select app_public.current_user_member_organization_ids()));
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

--! split: 550-default-category.sql
create function app_private.tg_organizations__create_default_category() returns trigger as $$
begin
  insert into app_public.categories(organization_id, name) VALUES(NEW.id, 'Sunday Morning');

  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

create trigger _200_create_default_category after insert on app_public.organizations for each row execute procedure app_private.tg_organizations__create_default_category();

-- Let's populate old orgs
insert into app_public.categories(organization_id, name) 
  select id, 'Sunday Morning'
  from app_public.organizations;

--! split: 600-project-columns.sql
ALTER TABLE app_public.projects
  ADD COLUMN name text not null default '',
  ADD COLUMN target_date timestamptz null,
  ADD COLUMN category_id uuid null references app_public.categories(id) on delete cascade;

create index on "app_public"."projects"("category_id");
  
grant insert(organization_id, creator_user_id, slug, name, target_date, category_id) on app_public.projects to :DATABASE_VISITOR;
grant update(slug, name, target_date, category_id) on app_public.projects to :DATABASE_VISITOR;

/*====================================*/
/*============ Constraints ===========*/
/*====================================*/
create function app_private.tg_projects__forbid_if_category_is_not_same_org() returns trigger as $$
DECLARE
  v_category_org_id uuid;
begin
  select organization_id into v_category_org_id from app_public.categories where id = NEW.category_id;

  if (v_category_org_id <> NEW.organization_id) then
    raise exception 'Cannot assign this category to this project since they below to different organization' using errcode='CRORG';
  end if;
  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

create trigger _200_forbid_if_category_is_not_same_org before insert or update on app_public.projects for each row execute procedure app_private.tg_projects__forbid_if_category_is_not_same_org();

--! split: 700-create-update-delete-project.sql
create function app_public.create_full_project(p_organization_id uuid, name text, slug text, tags uuid[], category_id uuid = null, target_date timestamptz = null) returns app_public.projects as $$
declare
  v_project app_public.projects;
  tag_id uuid;
begin
  insert into app_public.projects (organization_id, name, slug, category_id, target_date, creator_user_id) values (p_organization_id, name, slug, category_id, target_date, app_public.current_user_id()) returning * into v_project;
  foreach tag_id in array tags loop
    insert into app_public.project_tags (project_id, tag_id) values (v_project.id, tag_id);
  end loop;

  return v_project;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

grant insert(organization_id, name, slug, category_id, target_date, creator_user_id) on app_public.projects to :DATABASE_VISITOR;
-- Allow update
grant update(name, slug, category_id, target_date) on app_public.projects to :DATABASE_VISITOR;
grant delete on app_public.projects to :DATABASE_VISITOR;

create policy update_own_org on app_public.projects for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on app_public.projects for delete using (organization_id in (select app_public.current_user_member_organization_ids()));
