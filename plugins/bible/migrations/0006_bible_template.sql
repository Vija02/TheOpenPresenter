-- ---------------------------------------------------------------------------
-- The organization's last saved slide template
-- ---------------------------------------------------------------------------
create table bible_template (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null unique
    references app_public.organizations (id) on delete cascade,

  template jsonb not null,
  show_verse_numbers boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger _100_timestamps
  before insert or update on bible_template
  for each row
  execute procedure app_private.tg__timestamps();

comment on table bible_template is E'@cloudSync';

-- ---------------------------------------------------------------------------
-- Access scoped to the caller's organizations
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on bible_template to :DATABASE_VISITOR;

alter table bible_template enable row level security;

create policy select_own_org on bible_template for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on bible_template for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on bible_template for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on bible_template for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));
