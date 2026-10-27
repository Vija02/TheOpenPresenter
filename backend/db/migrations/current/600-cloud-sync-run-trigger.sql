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
