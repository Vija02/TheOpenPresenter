--! Previous: sha1:713a8459ee9a1a3193b5499121d594e79678eaa0
--! Hash: sha1:fb4107190329d84649d5de74a6e3fd7eaddc8109

--! split: 100-reset.sql
drop function if exists app_public.create_full_project(uuid, text, text, uuid[], uuid, timestamptz, uuid);
drop function if exists app_public.create_full_project(uuid, text, text, uuid[], uuid, timestamptz, uuid, time);
drop function if exists app_hidden.copy_project_content(uuid, uuid);
drop trigger if exists _200_forbid_template_from_other_org on app_public.categories;
drop function if exists app_private.tg_categories__forbid_template_from_other_org();

alter table app_public.categories
  drop column if exists recurrence,
  drop column if exists recurrence_anchor,
  drop column if exists start_time,
  drop column if exists duration_minutes,
  drop column if exists template_project_id;

drop function if exists app_public.reorder_categories(uuid[]);
drop trigger if exists _150_default_sort_order on app_public.categories;
drop function if exists app_private.tg_categories__default_sort_order();
drop index if exists app_public.categories_sort_order_idx;
alter table app_public.categories drop column if exists sort_order;

alter table app_public.categories drop column if exists show_in_filter;

drop trigger if exists _300_single_default on app_public.categories;
drop function if exists app_private.tg_categories__single_default();
alter table app_public.categories drop column if exists is_default;

-- Put back the committed sync hint trigger before dropping target_time
drop trigger if exists _900_cloud_sync_hint_update on app_public.projects;
create trigger _900_cloud_sync_hint_update
  after update on app_public.projects
  for each row when (
    (OLD.name, OLD.target_date, OLD.category_id, OLD.is_temporary)
      is distinct from
    (NEW.name, NEW.target_date, NEW.category_id, NEW.is_temporary)
  )
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
alter table app_public.projects drop column if exists target_time;

alter table app_private.cloud_sync_rows
  drop column if exists pull_deferred,
  drop column if exists push_deferred;

--! split: 300-category-defaults.sql
alter table app_public.categories
  add column recurrence text
    check (recurrence is null or (recurrence ~ '^FREQ=' and length(recurrence) <= 200)),
  add column recurrence_anchor date,
  add column start_time time,
  add column duration_minutes integer
    check (duration_minutes is null or duration_minutes between 1 and 1440),
  add column template_project_id uuid
    references app_public.projects(id) on delete set null;

create index categories_template_project_id_idx
  on app_public.categories(template_project_id);

grant
  insert(recurrence, recurrence_anchor, start_time, duration_minutes, template_project_id),
  update(recurrence, recurrence_anchor, start_time, duration_minutes, template_project_id)
  on app_public.categories to :DATABASE_VISITOR;

comment on column app_public.categories.recurrence is
  E'When projects in this category happen, as an RFC 5545 RRULE (e.g. FREQ=WEEKLY;BYDAY=SU).';
comment on column app_public.categories.recurrence_anchor is
  E'A day the cadence lands on, so "every 2 weeks" knows which weeks.';
comment on column app_public.categories.start_time is
  E'Usual start time, in the organization''s local time.';
comment on column app_public.categories.duration_minutes is
  E'Usual length in minutes.';
comment on column app_public.categories.template_project_id is
  E'New projects in this category start as a copy of this project.';

create function app_private.tg_categories__forbid_template_from_other_org() returns trigger as $$
begin
  if NEW.template_project_id is not null and not exists (
    select 1 from app_public.projects
    where id = NEW.template_project_id and organization_id = NEW.organization_id
  ) then
    raise exception 'The default project must belong to the same organization' using errcode = 'CRORG';
  end if;
  return NEW;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

create trigger _200_forbid_template_from_other_org
  before insert or update of template_project_id, organization_id on app_public.categories
  for each row execute procedure app_private.tg_categories__forbid_template_from_other_org();

--! split: 400-category-order.sql
alter table app_public.categories add column sort_order integer;

-- Leading column, so PostGraphile offers SORT_ORDER_ASC. Created before the
-- backfill, or Postgres flags it indcheckxmin and PostGraphile ignores it.
create index categories_sort_order_idx on app_public.categories(sort_order);

update app_public.categories c
  set sort_order = o.rn
  from (
    select id, row_number() over (partition by organization_id order by name) - 1 as rn
    from app_public.categories
  ) o
  where o.id = c.id;

alter table app_public.categories alter column sort_order set not null;

-- @hasDefault: optional on create, the trigger below fills it in
comment on column app_public.categories.sort_order is
  E'@hasDefault\nPosition of this category in its organization''s list, lowest first.';

-- New categories go to the end
create function app_private.tg_categories__default_sort_order() returns trigger as $$
begin
  if NEW.sort_order is null then
    select coalesce(max(sort_order) + 1, 0) into NEW.sort_order
      from app_public.categories
      where organization_id = NEW.organization_id;
  end if;
  return NEW;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

create trigger _150_default_sort_order
  before insert on app_public.categories
  for each row
  execute procedure app_private.tg_categories__default_sort_order();

grant insert(sort_order), update(sort_order) on app_public.categories to :DATABASE_VISITOR;

create function app_public.reorder_categories(category_ids uuid[])
returns setof app_public.categories as $$
  update app_public.categories c
    set sort_order = ids.idx - 1
    from unnest(category_ids) with ordinality as ids(id, idx)
    where c.id = ids.id
  returning c.*;
$$ language sql volatile;

comment on function app_public.reorder_categories(uuid[]) is
  E'Sets the order of the given categories to the order of the array.';

--! split: 500-category-show-in-filter.sql
alter table app_public.categories
  add column show_in_filter boolean not null default true;

comment on column app_public.categories.show_in_filter is
  E'Whether this category gets its own quick filter on the projects page.';

grant insert(show_in_filter), update(show_in_filter)
  on app_public.categories to :DATABASE_VISITOR;

--! split: 600-project-target-time.sql
alter table app_public.projects add column target_time time;

comment on column app_public.projects.target_time is
  E'When on `target_date` it starts, as wall-clock time in the church''s own zone. Null for a day only.';

grant insert(target_time), update(target_time) on app_public.projects to :DATABASE_VISITOR;

-- A time is only meaningful on a date; otherwise sync could never settle it
alter table app_public.projects
  add constraint projects_target_time_needs_date
  check (target_time is null or target_date is not null);

drop trigger if exists _900_cloud_sync_hint_update on app_public.projects;
create trigger _900_cloud_sync_hint_update
  after update on app_public.projects
  for each row when (
    (OLD.name, OLD.target_date, OLD.target_time, OLD.category_id, OLD.is_temporary)
      is distinct from
    (NEW.name, NEW.target_date, NEW.target_time, NEW.category_id, NEW.is_temporary)
  )
  execute procedure app_private.tg__cloud_sync_hint('organization_id');

-- Same as committed 000047, plus target_time
create or replace function app_public.duplicate_project(project_id uuid, name text default null) returns app_public.projects as $$
declare
  v_source app_public.projects;
  v_project app_public.projects;
  v_name text;
  v_base_slug citext;
  v_slug citext;
  v_suffix int := 1;
begin
  select * into v_source from app_public.projects where id = project_id;

  if v_source.id is null then
    raise exception 'Project not found' using errcode = 'NTFND';
  end if;

  if v_source.organization_id not in (select app_public.current_user_member_organization_ids()) then
    raise exception 'You do not have access to this project' using errcode = 'DNIED';
  end if;

  v_name := coalesce(
    duplicate_project.name,
    case when v_source.name = '' then '' else v_source.name || ' (copy)' end
  );

  v_base_slug := v_source.slug || '-copy';
  v_slug := v_base_slug;

  while exists(
    select 1 from app_public.projects
    where organization_id = v_source.organization_id and slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into app_public.projects (
    organization_id,
    creator_user_id,
    name,
    slug,
    category_id,
    target_date,
    target_time
  ) values (
    v_source.organization_id,
    app_public.current_user_id(),
    v_name,
    v_slug,
    v_source.category_id,
    v_source.target_date,
    v_source.target_time
  ) returning * into v_project;

  insert into app_public.project_tags (project_id, tag_id)
  select v_project.id, pt.tag_id
  from app_public.project_tags pt
  where pt.project_id = v_source.id;

  -- Defined in 900-create-full-project.sql
  perform app_hidden.copy_project_content(v_source.id, v_project.id);
  select * into v_project from app_public.projects where id = v_project.id;

  return v_project;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

--! split: 700-category-is-default.sql
alter table app_public.categories
  add column is_default boolean not null default false;

comment on column app_public.categories.is_default is
  E'New projects start in this category when none is picked. At most one per organization.';

grant insert(is_default), update(is_default)
  on app_public.categories to :DATABASE_VISITOR;

-- Making one the default takes it off the others
create function app_private.tg_categories__single_default() returns trigger as $$
begin
  update app_public.categories
    set is_default = false
    where organization_id = NEW.organization_id
      and id <> NEW.id
      and is_default;
  return null;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

create trigger _300_single_default
  after insert or update of is_default on app_public.categories
  for each row when (NEW.is_default)
  execute procedure app_private.tg_categories__single_default();

--! split: 800-cloud-sync-deferred.sql
-- A row synced without an optional project reference, because the project
-- was not on the receiving side yet. It is synced again once it is.
--   pull_deferred: the cloud's reference is not applied here yet
--   push_deferred: this side's reference is not on the cloud yet
alter table app_private.cloud_sync_rows
  add column pull_deferred boolean not null default false,
  add column push_deferred boolean not null default false;

--! split: 900-create-full-project.sql
create function app_hidden.copy_project_content(p_from uuid, p_to uuid) returns void as $$
declare
  v_from app_public.projects;
  v_to app_public.projects;
begin
  select * into v_from from app_public.projects where id = p_from;
  select * into v_to from app_public.projects where id = p_to;

  -- Deleted since it was picked: leave the new project blank
  if v_from.id is null and v_to.id is not null then
    return;
  end if;

  if v_from.id is null or v_to.id is null
    or v_from.organization_id <> v_to.organization_id
    or v_from.organization_id not in (select app_public.current_user_member_organization_ids())
  then
    raise exception 'Project not found' using errcode = 'NTFND';
  end if;

  update app_public.projects set document = v_from.document where id = p_to;

  insert into app_public.project_medias (project_id, media_id, plugin_id)
  select p_to, pm.media_id, pm.plugin_id
  from app_public.project_medias pm
  where pm.project_id = p_from
  on conflict do nothing;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

revoke all on function app_hidden.copy_project_content(uuid, uuid) from public;
grant execute on function app_hidden.copy_project_content(uuid, uuid) to :DATABASE_VISITOR;

drop function if exists app_public.create_full_project(uuid, text, text, uuid[], uuid, timestamptz);

create function app_public.create_full_project(
  p_organization_id uuid,
  name text,
  slug text,
  tags uuid[],
  category_id uuid default null,
  target_date timestamptz default null,
  template_project_id uuid default null,
  target_time time default null
) returns app_public.projects as $$
declare
  v_project app_public.projects;
  tag_id uuid;
begin
  insert into app_public.projects (organization_id, name, slug, category_id, target_date, target_time, creator_user_id) values (p_organization_id, name, slug, category_id, target_date, target_time, app_public.current_user_id()) returning * into v_project;
  foreach tag_id in array tags loop
    insert into app_public.project_tags (project_id, tag_id) values (v_project.id, tag_id);
  end loop;

  if template_project_id is not null then
    perform app_hidden.copy_project_content(template_project_id, v_project.id);
    select * into v_project from app_public.projects where id = v_project.id;
  end if;

  return v_project;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;
