--! Previous: sha1:83093f955e9f465ef79491d7fc55c637297e59b1
--! Hash: sha1:8f84f43605254c0edb42b4a10d6a92a4e62e9a06

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
-- 500
alter table app_private.cloud_sync_rows drop column if exists synced_value;
revoke insert (id) on app_public.projects from :DATABASE_VISITOR;

--! split: 400-cloud-sync-markers.sql
-- Opt core tables into cloud sync. Matched by name, which is unique per
-- organization; ids are each side's own. The descriptions are kept: PostGraphile
-- reads them from the same comment.
comment on table app_public.categories is E'Categories data\n@cloudSync';
comment on table app_public.tags is E'Tag data\n@cloudSync';

--! split: 500-project-sync.sql
-- Projects detect metadata changes by content, not `updated_at`: every
-- document save and tag change bumps a project's `updated_at`. This holds the
-- metadata as both sides agreed on it at the last sync.
alter table app_private.cloud_sync_rows add column synced_value jsonb;

-- A project created offline keeps its id on the cloud
grant insert (id) on app_public.projects to :DATABASE_VISITOR;
