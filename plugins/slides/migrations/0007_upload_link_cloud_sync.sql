-- ---------------------------------------------------------------------------
-- Sync upload links with the cloud, so a link made here can be opened from
-- anywhere, and slides uploaded to the cloud reach this install.
-- ---------------------------------------------------------------------------

-- The live upload is the one whose import succeeded and that nothing has
-- replaced since. Kept as a column it made the two tables reference each
-- other, which sync cannot order.
drop index if exists upload_link_current_upload_id_idx;
alter table upload_link drop column if exists current_upload_id;

-- Sync needs every row scoped by organization and stamped when it changes.
alter table upload_link_upload
  add column if not exists organization_id uuid
    references app_public.organizations (id) on delete cascade;
update upload_link_upload u
  set organization_id = l.organization_id
  from upload_link l
  where l.id = u.upload_link_id and u.organization_id is null;
alter table upload_link_upload alter column organization_id set not null;
create index if not exists upload_link_upload_organization_id_idx
  on upload_link_upload (organization_id);

alter table upload_link_upload
  add column if not exists updated_at timestamptz not null default now();
update upload_link_upload set updated_at = coalesce(replaced_at, created_at);

create or replace trigger _100_timestamps
  before insert or update on upload_link_upload
  for each row
  execute procedure app_private.tg__timestamps();

-- The cloud applies pushed rows as the signed-in member.
grant insert, update, delete on upload_link to :DATABASE_VISITOR;
grant insert, update, delete on upload_link_upload to :DATABASE_VISITOR;

drop policy if exists insert_own_org on upload_link;
create policy insert_own_org on upload_link for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
drop policy if exists update_own_org on upload_link;
create policy update_own_org on upload_link for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
drop policy if exists delete_own_org on upload_link;
create policy delete_own_org on upload_link for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));

drop policy if exists select_own_org on upload_link_upload;
create policy select_own_org on upload_link_upload for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));
drop policy if exists insert_own_org on upload_link_upload;
create policy insert_own_org on upload_link_upload for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
drop policy if exists update_own_org on upload_link_upload;
create policy update_own_org on upload_link_upload for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
drop policy if exists delete_own_org on upload_link_upload;
create policy delete_own_org on upload_link_upload for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- A copy of a link or an upload would be a second one, not a kept edit.
comment on table upload_link is E'@cloudSync\n@cloudSyncConflict cloudWins';
comment on table upload_link_upload is E'@cloudSync\n@cloudSyncConflict cloudWins';
