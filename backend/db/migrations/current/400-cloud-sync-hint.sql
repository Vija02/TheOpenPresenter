/*
 * Give hints (notify) when something changes on our table that
 * needs to be synced. Only sends a notify when the org is in
 * cloud connection.
 * Fail fast on cloud for performance
 */
create function app_private.tg__cloud_sync_hint() returns trigger as $$
declare
  v_row jsonb;
  v_organization_id uuid;
begin
  if not exists (select 1 from app_public.cloud_connections) then
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
