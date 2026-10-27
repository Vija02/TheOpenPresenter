--! Previous: sha1:65105fc02ace6a64b7ca64af7981869bced52823
--! Hash: sha1:b6b7bfde12acaf49a588478508ba62cc5bbd4e47

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
alter table app_public.cloud_sync_runs drop column if exists trigger;
drop type if exists app_public.cloud_sync_trigger;

-- Dropping the trigger function drops every trigger using it
drop function if exists app_private.attach_cloud_sync_hints();
drop function if exists app_private.tg__cloud_sync_hint() cascade;
drop table if exists app_private.cloud_sync_presence;

--! split: 300-cloud-sync-presence.sql
/*
 * Presence tracker in the cloud to know which studio instances are running
 */
create table app_private.cloud_sync_presence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references app_public.organizations on delete cascade,
  seen_at timestamptz not null default now()
);
create index on app_private.cloud_sync_presence (organization_id);

--! split: 400-cloud-sync-hint.sql
/*
 * Give hints (notify) when something changes on our table that
 * needs to be synced. Only sends a notify when the org is in
 * cloud connection (studio), or has a studio subscribed to it (cloud:
 * `app_private.cloud_sync_presence`).
 * Fail fast when neither for performance
 */
create function app_private.tg__cloud_sync_hint() returns trigger as $$
declare
  v_row jsonb;
  v_organization_id uuid;
begin
  if not exists (select 1 from app_public.cloud_connections)
    and not exists (select 1 from app_private.cloud_sync_presence) then
    return null;
  end if;

  v_row := to_jsonb(case when TG_OP = 'DELETE' then OLD else NEW end);
  if TG_ARGV[1] = 'project' then
    -- Gone already when the project's own delete cascaded here
    select organization_id into v_organization_id
    from app_public.projects
    where id = (v_row ->> TG_ARGV[0])::uuid;
  else
    v_organization_id := (v_row ->> TG_ARGV[0])::uuid;
  end if;

  if exists (
    select 1 from app_public.cloud_connections
    where organization_id = v_organization_id
  ) or exists (
    select 1 from app_private.cloud_sync_presence
    where organization_id = v_organization_id
      and seen_at > now() - interval '90 seconds'
  ) then
    perform pg_notify(
      'cloud_sync:' || v_organization_id,
      json_build_object(
        'entity', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
        'origin', nullif(current_setting('app.cloud_sync_origin', true), '')
      )::text
    );
  end if;
  return null;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

/*
 * Put the hint on every `@cloudSync` table.
 * Tables that have it already are skipped.
 */
create function app_private.attach_cloud_sync_hints() returns void as $$
declare
  v_table record;
begin
  for v_table in
    select n.nspname as schema_name, c.relname as table_name, (
      select a.attname from pg_constraint con
      join pg_attribute a on a.attrelid = c.oid and a.attnum = con.conkey[1]
      where con.conrelid = c.oid and con.contype = 'f'
        and con.confrelid = 'app_public.organizations'::regclass
        and cardinality(con.conkey) = 1
      limit 1
    ) as organization_column
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and (n.nspname like 'plugin\_%' or n.nspname = 'app_public')
      and obj_description(c.oid, 'pg_class') ~ '(^|\s)@cloudSync(\s|$)'
      and not exists (
        select 1 from pg_trigger t
        where t.tgrelid = c.oid and t.tgname = '_900_cloud_sync_hint'
      )
  loop
    -- The sync refuses such a table too.
    continue when v_table.organization_column is null;
    execute format(
      'create trigger _900_cloud_sync_hint
         after insert or update or delete on %I.%I
         for each row execute procedure app_private.tg__cloud_sync_hint(%L)',
      v_table.schema_name, v_table.table_name, v_table.organization_column
    );
  end loop;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

--! split: 500-cloud-sync-hint-triggers.sql
select app_private.attach_cloud_sync_hints();

-- Projects: only what project sync compares. `updated_at` moves with every
-- document save, which the document bridge carries instead.
create trigger _900_cloud_sync_hint_insert
  after insert on app_public.projects
  for each row when (not NEW.is_temporary)
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_update
  after update on app_public.projects
  for each row when (
    (OLD.name, OLD.target_date, OLD.category_id, OLD.is_temporary)
      is distinct from
    (NEW.name, NEW.target_date, NEW.category_id, NEW.is_temporary)
  )
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_delete
  after delete on app_public.projects
  for each row when (not OLD.is_temporary)
  execute procedure app_private.tg__cloud_sync_hint('organization_id');

create trigger _900_cloud_sync_hint
  after insert or update or delete on app_public.project_tags
  for each row
  execute procedure app_private.tg__cloud_sync_hint('project_id', 'project');

-- Media: once an upload is complete, not on every chunk.
create trigger _900_cloud_sync_hint_insert
  after insert on app_public.medias
  for each row when (NEW.is_complete)
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_update
  after update on app_public.medias
  for each row when (
    (OLD.is_complete, OLD.media_name, OLD.original_name, OLD.tags)
      is distinct from
    (NEW.is_complete, NEW.media_name, NEW.original_name, NEW.tags)
    and NEW.is_complete
  )
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_delete
  after delete on app_public.medias
  for each row
  execute procedure app_private.tg__cloud_sync_hint('organization_id');

create trigger _900_cloud_sync_hint
  after insert or delete on app_public.project_medias
  for each row
  execute procedure app_private.tg__cloud_sync_hint('project_id', 'project');

--! split: 600-cloud-sync-run-trigger.sql
--  Reason why the sync ran
create type app_public.cloud_sync_trigger as enum (
  'start',
  'manual',
  'schedule',
  'local_change',
  'local_media_change',
  'cloud_change',
  'cloud_media_change',
  'reconnect'
);

alter table app_public.cloud_sync_runs
  add column trigger app_public.cloud_sync_trigger;
