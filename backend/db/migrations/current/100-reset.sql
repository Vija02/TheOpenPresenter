-- 300
ALTER TABLE app_public.projects
  DROP COLUMN IF EXISTS cloud_connection_id,
  DROP COLUMN IF EXISTS cloud_last_updated,
  DROP COLUMN IF EXISTS cloud_should_sync;

-- 200
drop table if exists app_public.cloud_connections;