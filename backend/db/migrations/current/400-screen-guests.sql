create table app_public.screen_guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app_public.organizations(id) on delete cascade,

  display_name text not null,
  email text,
  passcode_hash text not null,

  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references app_public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.screen_guests (organization_id);
create index on app_public.screen_guests (created_by);

create index on app_public.screen_guests (display_name);
create index on app_public.screen_guests (created_at);

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.screen_guests
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.screen_guests enable row level security;
-- Policies
create policy select_member on app_public.screen_guests
  for select using (organization_id in (select app_public.current_user_member_organization_ids()));
-- Everything else goes through function since we need to hash passcode

-- Grants
grant select on app_public.screen_guests to :DATABASE_VISITOR;

comment on table app_public.screen_guests is
  E'Registered guest identities scoped to an organization.';
comment on column app_public.screen_guests.passcode_hash is
  E'@omit';
