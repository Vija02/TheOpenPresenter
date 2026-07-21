grant usage on schema plugin_bible to :DATABASE_VISITOR;
grant select, insert, update, delete on bible_preference to :DATABASE_VISITOR;

-- Access scoped to the caller's organizations (one preference row per org)
alter table bible_preference enable row level security;

create policy select_own_org on bible_preference for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on bible_preference for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on bible_preference for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on bible_preference for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));
