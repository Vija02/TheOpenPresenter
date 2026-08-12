grant usage on schema plugin_slides to :DATABASE_VISITOR;

-- ---------------------------------------------------------------------------
-- Connections. An organization may link several Canva accounts.
-- ---------------------------------------------------------------------------
create table if not exists canva_connection (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,

  canva_user_id text not null,
  canva_team_id text,

  canva_display_name text,

  connected_by_user_id uuid
    references app_public.users (id) on delete set null,

  scopes text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canva_connection_organization_id_idx
  on canva_connection (organization_id);

create unique index if not exists canva_connection_org_canva_user_key
  on canva_connection (organization_id, canva_user_id);

create or replace trigger _100_timestamps
  before insert or update on canva_connection
  for each row
  execute procedure app_private.tg__timestamps();

grant select on canva_connection to :DATABASE_VISITOR;

alter table canva_connection enable row level security;

-- CREATE POLICY has no "if not exists" form, so drop first.
drop policy if exists select_own_org on canva_connection;
create policy select_own_org on canva_connection for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- ---------------------------------------------------------------------------
-- Tokens (no visitor grants)
-- ---------------------------------------------------------------------------
create table if not exists canva_connection_secret (
  canva_connection_id uuid primary key
    references canva_connection (id) on delete cascade,

  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null
);

alter table canva_connection_secret enable row level security;

-- ---------------------------------------------------------------------------
-- Handles the PKCE state for the OAuth round trip
-- ---------------------------------------------------------------------------
create table if not exists canva_oauth_state (
  -- The opaque value sent to Canva as the `state` query parameter
  state_id text primary key,

  -- PKCE secret
  code_verifier text not null,

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,
  user_id uuid not null
    references app_public.users (id) on delete cascade,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

create index if not exists canva_oauth_state_expires_at_idx
  on canva_oauth_state (expires_at);

alter table canva_oauth_state enable row level security;
