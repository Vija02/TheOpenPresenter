alter table app_public.cloud_sync_runs drop column if exists trigger;
drop type if exists app_public.cloud_sync_trigger;

-- Dropping the trigger function drops every trigger using it
drop function if exists app_private.attach_cloud_sync_hints();
drop function if exists app_private.tg__cloud_sync_hint() cascade;
drop table if exists app_private.cloud_sync_presence;
