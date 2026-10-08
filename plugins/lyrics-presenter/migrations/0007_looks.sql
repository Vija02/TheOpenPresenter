-- ---------------------------------------------------------------------------
-- look: an organization's layouts, one per purpose
-- ---------------------------------------------------------------------------
create table look (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,

  -- Stable identifier: ("main", "fullSong", "lowerThird", etc)
  key      text not null,
  name     text not null,
  position integer not null default 0,

  template   jsonb not null,
  -- Null is no background
  background jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, key)
);

create trigger _100_timestamps
  before insert or update on look
  for each row
  execute procedure app_private.tg__timestamps();

-- Matched by key on both sides, so the cloud's edit wins
comment on table look is E'@cloudSync';

-- ---------------------------------------------------------------------------
-- Access scoped to the caller's organizations
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on look to :DATABASE_VISITOR;

alter table look enable row level security;

create policy select_own_org on look for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on look for insert
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on look for update
  using (organization_id in (select app_public.current_user_member_organization_ids()))
  with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own_org on look for delete
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- ---------------------------------------------------------------------------
-- Tell open scenes to refresh their copy
-- ---------------------------------------------------------------------------
create or replace function notify_look_change() returns trigger as $$
begin
  perform pg_notify(
    'lyrics_presenter_look',
    json_build_object(
      'organizationId', coalesce(NEW.organization_id, OLD.organization_id)
    )::text
  );
  return null;
end;
$$ language plpgsql;

create trigger look_notify
  after insert or update or delete on look
  for each row execute function notify_look_change();
