--! Previous: sha1:7d75af0f15b4e8537ea6f98549f30fdb214088ca
--! Hash: sha1:83093f955e9f465ef79491d7fc55c637297e59b1

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
drop table if exists app_private.cloud_sync_rows;

--! split: 300-cloud-sync-rows.sql
-- Each synced row's `updated_at` on both sides as of its last sync.
--
-- Each timestamp is only ever compared for equality against a later reading
-- from the same clock, so a skewed clock on either side cannot cause a missed
-- or phantom change:
--   changed on the cloud: cloud row's updated_at <> cloud_updated_at
--   changed locally:      local row's updated_at <> local_updated_at
--   deleted on a side:    state row exists, that side's row does not
create table app_private.cloud_sync_rows (
  cloud_connection_id uuid not null
    references app_public.cloud_connections (id) on delete cascade,
  -- `<schema>.<table>`
  entity text not null,
  -- The row's key columns, without the organization column (a connection is
  -- one organization on each side). `{}` for one-row-per-org tables.
  row_key jsonb not null,
  cloud_updated_at timestamptz not null,
  local_updated_at timestamptz not null,
  primary key (cloud_connection_id, entity, row_key)
);
alter table app_private.cloud_sync_rows enable row level security;
