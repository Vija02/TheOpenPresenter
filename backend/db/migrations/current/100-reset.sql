-- Dropping the trigger function drops every trigger using it
drop function if exists app_private.attach_cloud_sync_hints();
drop function if exists app_private.tg__cloud_sync_hint() cascade;
