-- ---------------------------------------------------------------------------
-- ChurchSuite Planning integration, through an API-enabled ChurchSuite user.
-- ---------------------------------------------------------------------------

create table if not exists churchsuite_connection (
  id uuid primary key default gen_random_uuid(),

  -- One ChurchSuite account per organization
  organization_id uuid not null unique
    references app_public.organizations (id) on delete cascade,

  -- Labels read from the ChurchSuite account when it was connected
  account_name text,
  account_subdomain text,

  connected_by_user_id uuid
    references app_public.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Triggers
create or replace trigger _100_timestamps
  before insert or update on churchsuite_connection
  for each row
  execute procedure app_private.tg__timestamps();

-- Grants
grant select on churchsuite_connection to :DATABASE_VISITOR;

alter table churchsuite_connection enable row level security;

-- Policy
drop policy if exists select_own_org on churchsuite_connection;
create policy select_own_org on churchsuite_connection for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- ---------------------------------------------------------------------------
-- Credentials. No visitor grants, so these are only reachable as the table owner.
-- ---------------------------------------------------------------------------
create table if not exists churchsuite_connection_secret (
  churchsuite_connection_id uuid primary key
    references churchsuite_connection (id) on delete cascade,

  client_id text not null,
  client_secret text not null,

  -- Short-lived token minted from the credentials above, cached between requests
  access_token text,
  access_token_expires_at timestamptz
);

alter table churchsuite_connection_secret enable row level security;
