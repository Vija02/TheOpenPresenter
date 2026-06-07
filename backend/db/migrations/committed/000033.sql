--! Previous: sha1:ec61ae35e576ea526eb24d492faf392cd263971b
--! Hash: sha1:4864a32a5efd145265d0edee743610105644d0a7

--! split: 100-reset.sql
-- 300
drop trigger if exists _600_bump_heartbeat_on_project_assign on app_public.screens;
drop trigger if exists _600_bump_heartbeat_on_project_change on app_public.screens;
drop function if exists app_private.tg__bump_screen_heartbeat_on_project_set();

-- 200
drop table if exists app_public.screen_heartbeats cascade;

--! split: 200-screen-heartbeats.sql
create table app_public.screen_heartbeats (
  screen_id uuid primary key references app_public.screens(id) on delete cascade,
  -- Duplicate of screen_id so tg__graphql_subscription can use 'id' as the attribute
  id uuid generated always as (screen_id) stored,

  last_seen_by_guest_at timestamptz,
  last_seen_by_admin_at timestamptz
);

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.screen_heartbeats enable row level security;

create policy select_for_org_member on app_public.screen_heartbeats
  for select using (
    screen_id in (
      select id from app_public.screens
      where organization_id in (
        select app_public.current_user_member_organization_ids()
      )
    )
  );

create policy select_for_guest_session on app_public.screen_heartbeats
  for select using (
    screen_id = (app_public.current_screen_guest_session()).screen_id
  );

-- Grants
grant select on app_public.screen_heartbeats to :DATABASE_VISITOR;

/*====================================*/
/*============= TRIGGERS =============*/
/*====================================*/
create trigger _500_gql_notify
  after insert or update on app_public.screen_heartbeats
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'screenHeartbeatUpdate',
    'graphql:scr_hb:$1',
    'screen_id'
  );

--! split: 300-screen-heartbeat-triggers.sql
-- Helps to set rows for heartbeats
create or replace function app_private.tg__bump_screen_heartbeat_on_project_set()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $$
begin
  insert into app_public.screen_heartbeats (screen_id, last_seen_by_admin_at)
  values (new.id, now())
  on conflict (screen_id) do update
    set last_seen_by_admin_at = excluded.last_seen_by_admin_at;
  return null;
end;
$$;

-- Fires on initial screen creation
create trigger _600_bump_heartbeat_on_project_assign
  after insert on app_public.screens
  for each row
  when (new.current_project_id is not null)
  execute function app_private.tg__bump_screen_heartbeat_on_project_set();

-- Fires when the assigned project changes
create trigger _600_bump_heartbeat_on_project_change
  after update of current_project_id on app_public.screens
  for each row
  when (
    new.current_project_id is not null
    and new.current_project_id is distinct from old.current_project_id
  )
  execute function app_private.tg__bump_screen_heartbeat_on_project_set();

-- One-shot backfill
insert into app_public.screen_heartbeats (screen_id, last_seen_by_admin_at)
select id, now()
from app_public.screens
where current_project_id is not null
on conflict (screen_id) do nothing;
