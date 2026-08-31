--! Previous: sha1:6c773b6bc754e7932efa6ea3c6f75bf5a7c60c46
--! Hash: sha1:2b4723370cfc014bb5d3b35dea573f23081416ca

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
-- 200
drop view if exists app_private.renderer_session_durations;
drop table if exists app_private.renderer_sessions cascade;

--! split: 200-renderer-sessions.sql
create table app_private.renderer_sessions (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  -- Kept nullable so analytics survive the project (e.g. demo projects) going away
  project_id uuid references app_public.projects(id) on delete set null,
  screen_id uuid references app_public.screens(id) on delete set null,
  user_id uuid references app_public.users(id) on delete set null,

  renderer_id text not null default '1',
  -- Track if flag is used
  is_preview boolean not null default false,

  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  -- 'disconnect' when we saw the socket close, 'stale' when the sweeper closed it
  end_reason text
);

create index renderer_sessions_organization_id_started_at_idx
  on app_private.renderer_sessions (organization_id, started_at desc);
create index on app_private.renderer_sessions (organization_id);
create index on app_private.renderer_sessions (project_id);
create index on app_private.renderer_sessions (screen_id);
create index on app_private.renderer_sessions (user_id);

-- Sweeper + heartbeat only ever touch open rows
create index renderer_sessions_open_idx
  on app_private.renderer_sessions (last_seen_at)
  where ended_at is null;

create view app_private.renderer_session_durations as
  select
    rs.*,
    o.slug = 'demo' as is_demo,
    extract(
      epoch from coalesce(rs.ended_at, rs.last_seen_at) - rs.started_at
    )::int as duration_seconds
  from app_private.renderer_sessions rs
  join app_public.organizations o on o.id = rs.organization_id;
