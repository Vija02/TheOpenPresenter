grant usage on schema plugin_lyrics_presenter to :DATABASE_VISITOR;
grant select, insert, update, delete on saved_song to :DATABASE_VISITOR;
grant select, insert, update, delete on recent_song to :DATABASE_VISITOR;

-- ---------------------------------------------------------------------------
-- saved_song
-- ---------------------------------------------------------------------------
alter table saved_song enable row level security;

create policy select_own_org on saved_song for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on saved_song for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on saved_song for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on saved_song for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- ---------------------------------------------------------------------------
-- recent_song
-- ---------------------------------------------------------------------------
alter table recent_song enable row level security;

create policy select_own_org on recent_song for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on recent_song for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on recent_song for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on recent_song for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));
