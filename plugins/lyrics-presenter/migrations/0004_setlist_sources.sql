-- ---------------------------------------------------------------------------
-- Per-organization setlist import sources.
-- ---------------------------------------------------------------------------

create table if not exists setlist_source (
  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,

  -- Matches the `source` discriminator used by the client, e.g. "myworshiplist"
  source text not null,

  enabled boolean not null default true,

  enabled_by_user_id uuid
    references app_public.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (organization_id, source)
);

-- Triggers
create or replace trigger _100_timestamps
  before insert or update on setlist_source
  for each row
  execute procedure app_private.tg__timestamps();

grant select, insert, update, delete on setlist_source to :DATABASE_VISITOR;

alter table setlist_source enable row level security;

-- Policies
drop policy if exists select_own_org on setlist_source;
create policy select_own_org on setlist_source for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));

drop policy if exists insert_own_org on setlist_source;
create policy insert_own_org on setlist_source for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));

drop policy if exists update_own_org on setlist_source;
create policy update_own_org on setlist_source for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));

drop policy if exists delete_own_org on setlist_source;
create policy delete_own_org on setlist_source for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));
