--! Previous: sha1:f46def400587086c7d10f28281673dee961ca94f
--! Hash: sha1:80c95de3a7f585ea56c28b0ac3f321131ca4ef28

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
drop table if exists app_private.integration_intents;

--! split: 300-integration-intents.sql
-- A short-lived hand-off for integrations that must finish in a real browser
-- on this server
create table app_private.integration_intents (
  -- The id is the capability
  id text primary key,
  -- Namespaced by plugin, e.g. `slides/google`
  provider text not null,
  -- What the browser step is for, e.g. `connect` or `pick`
  kind text not null,
  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,
  -- Who started it. Only they may read the result.
  user_id uuid not null
    references app_public.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'failed')),
  input jsonb not null default '{}',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index on app_private.integration_intents (expires_at);
create index on app_private.integration_intents (organization_id);
create index on app_private.integration_intents (user_id);
alter table app_private.integration_intents enable row level security;
