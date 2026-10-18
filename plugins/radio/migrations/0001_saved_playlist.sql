-- ---------------------------------------------------------------------------
-- saved_playlist: an organization's playlists, reusable across scenes
-- ---------------------------------------------------------------------------
create table saved_playlist (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,
  created_by_user_id uuid
    references app_public.users (id) on delete set null,

  name   text not null,
  tracks jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on saved_playlist (organization_id, updated_at desc);
create index on saved_playlist (created_by_user_id);

create trigger _100_timestamps
  before insert or update on saved_playlist
  for each row
  execute procedure app_private.tg__timestamps();

comment on table saved_playlist is E'@cloudSync\n@cloudSyncCopyLabel name';

-- ---------------------------------------------------------------------------
-- Access scoped to the caller's organizations
-- ---------------------------------------------------------------------------
grant usage on schema plugin_radio to :DATABASE_VISITOR;
grant select, insert, update, delete on saved_playlist to :DATABASE_VISITOR;

alter table saved_playlist enable row level security;

create policy select_own_org on saved_playlist for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on saved_playlist for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on saved_playlist for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on saved_playlist for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));
