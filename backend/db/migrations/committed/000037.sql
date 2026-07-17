--! Previous: sha1:9eeecdd61211937f20a41bb61e6adc3d964fbf2e
--! Hash: sha1:7b218d57cb9b1830f6fb9e99bb50cf8f3eac975a

--! split: 1-current.sql
-- Enter migration here

--! split: 100-cloud-sync-reset.sql
-- 300
drop table if exists app_public.cloud_sync_items cascade;
drop table if exists app_public.cloud_sync_runs cascade;

-- 200
drop type if exists app_public.cloud_sync_item_status cascade;
drop type if exists app_public.cloud_sync_run_status cascade;

--! split: 200-cloud-sync-enums.sql
create type app_public.cloud_sync_run_status as enum (
  'pending',
  'in_progress',
  'completed',
  'failed'
);

create type app_public.cloud_sync_item_status as enum (
  'pending',
  'syncing',
  'synced',
  'failed'
);

--! split: 300-cloud-sync-tables.sql
create table app_public.cloud_sync_runs (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  cloud_connection_id uuid not null references app_public.cloud_connections(id) on delete cascade,

  force_resync boolean not null default false,

  status app_public.cloud_sync_run_status not null default 'pending',
  total_projects integer not null default 0,
  projects_to_sync integer not null default 0,
  synced_projects integer not null default 0,
  failed_projects integer not null default 0,
  projects_to_delete integer not null default 0,
  deleted_projects integer not null default 0,

  -- Media
  media_status app_public.cloud_sync_item_status not null default 'pending',
  total_media integer not null default 0,
  synced_media integer not null default 0,
  total_bytes bigint not null default 0,
  downloaded_bytes bigint not null default 0,

  error text,
  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on app_public.cloud_sync_runs (organization_id);
create index on app_public.cloud_sync_runs (cloud_connection_id);
create index on app_public.cloud_sync_runs (created_at);

create trigger _100_timestamps
  before insert or update on app_public.cloud_sync_runs
  for each row execute procedure app_private.tg__timestamps();

alter table app_public.cloud_sync_runs enable row level security;

-- Read-only from the client; all writes happen in the worker (owner role).
create policy select_own on app_public.cloud_sync_runs
  for select using (organization_id in (select app_public.current_user_member_organization_ids()));

grant select on app_public.cloud_sync_runs to :DATABASE_VISITOR;
