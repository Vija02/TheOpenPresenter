-- ---------------------------------------------------------------------------
-- Planning Center Services integration.
-- ---------------------------------------------------------------------------

create table if not exists pco_connection (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,

  -- Identity of the authorizing account inside Planning Center
  pco_organization_id text not null,
  pco_organization_name text,
  pco_person_id text not null,
  pco_person_name text,

  connected_by_user_id uuid
    references app_public.users (id) on delete set null,

  scopes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index
create index if not exists pco_connection_organization_id_idx
  on pco_connection (organization_id);

create unique index if not exists pco_connection_org_account_key
  on pco_connection (organization_id, pco_organization_id, pco_person_id);

-- Triggers
create or replace trigger _100_timestamps
  before insert or update on pco_connection
  for each row
  execute procedure app_private.tg__timestamps();

-- Grants
grant select on pco_connection to :DATABASE_VISITOR;

alter table pco_connection enable row level security;

-- Policy
drop policy if exists select_own_org on pco_connection;
create policy select_own_org on pco_connection for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- ---------------------------------------------------------------------------
-- Tokens. No visitor grants, so these are only reachable as the table owner.
-- ---------------------------------------------------------------------------
create table if not exists pco_connection_secret (
  pco_connection_id uuid primary key
    references pco_connection (id) on delete cascade,

  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null
);

alter table pco_connection_secret enable row level security;

-- ---------------------------------------------------------------------------
-- PKCE state for the OAuth round trip.
-- ---------------------------------------------------------------------------
create table if not exists pco_oauth_state (
  -- The opaque value sent to Planning Center as the `state` query parameter
  state_id text primary key,

  -- PKCE secret. Only its SHA-256 challenge ever leaves this server.
  code_verifier text not null,

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,
  user_id uuid not null
    references app_public.users (id) on delete cascade,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

create index if not exists pco_oauth_state_expires_at_idx
  on pco_oauth_state (expires_at);

alter table pco_oauth_state enable row level security;
