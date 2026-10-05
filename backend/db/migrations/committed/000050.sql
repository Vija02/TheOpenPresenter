--! Previous: sha1:8f84f43605254c0edb42b4a10d6a92a4e62e9a06
--! Hash: sha1:6753e0fd86e6fbacbeb5fc75b0b647648dc6e5e2

--! split: 1-current.sql
-- Enter migration here

--! split: 300-media-sync-state.sql
-- Media and their links are never edited, only added and removed, so their
-- state rows record no timestamps.
alter table app_private.cloud_sync_rows
  alter column cloud_updated_at drop not null,
  alter column local_updated_at drop not null;
