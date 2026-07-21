grant usage on schema plugin_bible to :DATABASE_VISITOR;
grant select, insert, update, delete on translation to :DATABASE_VISITOR;
grant select, insert, update, delete on translation_chapter to :DATABASE_VISITOR;

-- translation
alter table translation enable row level security;

create policy select_public_or_own_org on translation for select
  using (
    organization_id is null
    or organization_id in (select app_public.current_user_member_organization_ids())
  );
create policy insert_own_org on translation for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on translation for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on translation for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- translation_chapter (same policies as translation)
alter table translation_chapter enable row level security;

create policy select_public_or_own_org on translation_chapter for select
  using (
    organization_id is null
    or organization_id in (select app_public.current_user_member_organization_ids())
  );
create policy insert_own_org on translation_chapter for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on translation_chapter for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on translation_chapter for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));
