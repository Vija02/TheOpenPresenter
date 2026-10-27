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
