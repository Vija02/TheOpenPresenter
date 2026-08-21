--! Previous: sha1:01b593a9c47df56b185c295c10b71e684cef25dd
--! Hash: sha1:771e3ec43d6c696f30411dfd65f776570a2538fc

--! split: 100-reset.sql
-- 910
drop function if exists app_public.upsert_client_plugin_draft(uuid, jsonb, jsonb) cascade;

-- 810
do $$
begin
  if to_regclass('app_public.client_plugin_versions') is not null then
    drop policy if exists select_installed on app_public.client_plugin_versions;
  end if;

  if to_regclass('app_public.client_plugins') is not null then
    drop policy if exists select_installed on app_public.client_plugins;
  end if;
end;
$$;

-- 550
drop table if exists app_public.client_plugin_drafts cascade;

-- 540
drop table if exists app_public.organization_client_plugins cascade;

-- 520
do $$
begin
  if to_regclass('app_public.client_plugins') is not null then
    alter table app_public.client_plugins
      drop constraint if exists client_plugins_latest_version_id_fkey;
  end if;
end;
$$;

-- 510
drop table if exists app_public.client_plugin_versions cascade;

-- 500
drop table if exists app_public.client_plugins cascade;

-- 200
drop type if exists app_public.client_plugin_build_status cascade;
drop type if exists app_public.client_plugin_review_status cascade;
drop type if exists app_public.client_plugin_visibility cascade;

--! split: 200-enums.sql
create type app_public.client_plugin_visibility as enum (
  'private',
  'unlisted',
  'public'
);

create type app_public.client_plugin_review_status as enum (
  'draft',
  'pending',
  'approved',
  'rejected'
);

create type app_public.client_plugin_build_status as enum (
  'pending',
  'built',
  'failed'
);

--! split: 500-client_plugins.sql
-- Main entry of client plugin
create table app_public.client_plugins (
  id uuid primary key default gen_random_uuid(),

  owner_organization_id uuid not null references app_public.organizations(id) on delete cascade,

  handle citext not null,
  title text not null,
  description text not null default '',

  -- FK to client_plugin_versions added later (circular dependency).
  latest_version_id uuid,

  -- Marketplace data
  visibility app_public.client_plugin_visibility not null default 'private',
  review_status app_public.client_plugin_review_status not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app_public.client_plugins is
  E'A frontend-only plugin authored by an organization';

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.client_plugins(owner_organization_id);
create unique index client_plugins_owner_handle_idx
  on app_public.client_plugins(owner_organization_id, handle);
create index client_plugins_public_idx
  on app_public.client_plugins(visibility, review_status);

/*====================================*/
/*============ Timestamps ============*/
/*====================================*/
create trigger _100_timestamps
  before insert or update on app_public.client_plugins
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.client_plugins enable row level security;

-- Owner org members: full read/write
create policy manage_own on app_public.client_plugins
  for all using (owner_organization_id in (select app_public.current_user_member_organization_ids()))
  with check (owner_organization_id in (select app_public.current_user_member_organization_ids()));

-- Anyone authenticated can read public + approved plugins
create policy select_public on app_public.client_plugins
  for select using (visibility = 'public' and review_status = 'approved');

/*====================================*/
/*=============== Grants =============*/
/*====================================*/
grant select on app_public.client_plugins to :DATABASE_VISITOR;
grant insert(owner_organization_id, handle, title, description, visibility)
  on app_public.client_plugins to :DATABASE_VISITOR;
grant update(title, description, visibility)
  on app_public.client_plugins to :DATABASE_VISITOR;
grant delete on app_public.client_plugins to :DATABASE_VISITOR;

--! split: 510-client_plugin_versions.sql
-- Record of each version
create table app_public.client_plugin_versions (
  id uuid primary key default gen_random_uuid(),

  client_plugin_id uuid not null references app_public.client_plugins(id) on delete cascade,

  version text not null,

  manifest jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,

  build_status app_public.client_plugin_build_status not null default 'pending',
  build_log text not null default '',

  -- Built artifacts live in object storage (S3/file) 
  -- This lists the produced filenames + content types
  artifacts jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

comment on table app_public.client_plugin_versions is
  E'An immutable, built version of a client plugin. Contains authored source and a manifest. Built artifacts are stored in object storage and listed in the artifacts column';

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.client_plugin_versions(client_plugin_id);
create index on app_public.client_plugin_versions(created_at);
create unique index client_plugin_versions_plugin_version_idx
  on app_public.client_plugin_versions(client_plugin_id, version);

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.client_plugin_versions enable row level security;

-- Owner org members: full read/write via the parent plugin
create policy manage_own on app_public.client_plugin_versions
  for all using (
    client_plugin_id in (
      select id from app_public.client_plugins
      where owner_organization_id in (select app_public.current_user_member_organization_ids())
    )
  )
  with check (
    client_plugin_id in (
      select id from app_public.client_plugins
      where owner_organization_id in (select app_public.current_user_member_organization_ids())
    )
  );

-- Anyone authenticated can read versions of public + approved plugins
create policy select_public on app_public.client_plugin_versions
  for select using (
    client_plugin_id in (
      select id from app_public.client_plugins
      where visibility = 'public' and review_status = 'approved'
    )
  );

/*====================================*/
/*=============== Grants =============*/
/*====================================*/
grant select on app_public.client_plugin_versions to :DATABASE_VISITOR;
grant insert(client_plugin_id, version, manifest, source) on app_public.client_plugin_versions to :DATABASE_VISITOR;
-- No update & delete, it should be immutable

--! split: 520-latest-version-fk.sql
-- Close the circular reference: client_plugins.latest_version_id -> client_plugin_versions
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_plugins_latest_version_id_fkey'
  ) then
    alter table app_public.client_plugins
      add constraint client_plugins_latest_version_id_fkey
      foreign key (latest_version_id)
      references app_public.client_plugin_versions(id)
      on delete set null;
  end if;
end;
$$;

--! split: 540-organization_client_plugins.sql
-- 540-organization_client_plugins.sql
-- Org-level install/enable of a client plugin, pinned to an explicit version.
-- (drops live in 100-reset.sql)

create table app_public.organization_client_plugins (
  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  client_plugin_id uuid not null references app_public.client_plugins(id) on delete cascade,

  pinned_version_id uuid not null references app_public.client_plugin_versions(id) on delete restrict,

  enabled boolean not null default true,

  installed_at timestamptz not null default now(),

  primary key (organization_id, client_plugin_id)
);

comment on table app_public.organization_client_plugins is
  E'Records that an organization has installed a client plugin, pinned to a specific version';

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.organization_client_plugins(organization_id);
create index on app_public.organization_client_plugins(client_plugin_id);
create index on app_public.organization_client_plugins(pinned_version_id);

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.organization_client_plugins enable row level security;

-- Only members of the installing org can see/manage their installs.
create policy select_own on app_public.organization_client_plugins
  for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own on app_public.organization_client_plugins
  for insert with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own on app_public.organization_client_plugins
  for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own on app_public.organization_client_plugins
  for delete using (organization_id in (select app_public.current_user_member_organization_ids()));

/*====================================*/
/*=============== Grants =============*/
/*====================================*/
grant select on app_public.organization_client_plugins to :DATABASE_VISITOR;
grant insert(organization_id, client_plugin_id, pinned_version_id, enabled)
  on app_public.organization_client_plugins to :DATABASE_VISITOR;
grant update(pinned_version_id, enabled) on app_public.organization_client_plugins to :DATABASE_VISITOR;
grant delete on app_public.organization_client_plugins to :DATABASE_VISITOR;

--! split: 550-client_plugin_drafts.sql
-- Autosaved draft of the changes made
create table app_public.client_plugin_drafts (
  client_plugin_id uuid primary key references app_public.client_plugins(id) on delete cascade,

  source jsonb not null default '{}'::jsonb,
  manifest jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table app_public.client_plugin_drafts is
  E'Autosaved working copy. Promoted into an immutable client_plugin_versions row on build';

/*====================================*/
/*============ Timestamps ============*/
/*====================================*/
create trigger _100_timestamps
  before insert or update on app_public.client_plugin_drafts
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.client_plugin_drafts enable row level security;

-- Organization members manage the shared draft for plugins their org owns.
create policy manage_own on app_public.client_plugin_drafts
  for all using (
    client_plugin_id in (
      select id from app_public.client_plugins
      where owner_organization_id in (select app_public.current_user_member_organization_ids())
    )
  )
  with check (
    client_plugin_id in (
      select id from app_public.client_plugins
      where owner_organization_id in (select app_public.current_user_member_organization_ids())
    )
  );

/*====================================*/
/*=============== Grants =============*/
/*====================================*/
grant select on app_public.client_plugin_drafts to :DATABASE_VISITOR;
grant insert(client_plugin_id, source, manifest) on app_public.client_plugin_drafts to :DATABASE_VISITOR;
grant update(source, manifest) on app_public.client_plugin_drafts to :DATABASE_VISITOR;
grant delete on app_public.client_plugin_drafts to :DATABASE_VISITOR;

--! split: 810-installed-read-policies.sql
-- Allow access for org to access those that they install
drop policy if exists select_installed on app_public.client_plugin_versions;
create policy select_installed on app_public.client_plugin_versions
  for select using (
    id in (
      select ocp.pinned_version_id
        from app_public.organization_client_plugins ocp
       where ocp.organization_id in (select app_public.current_user_member_organization_ids())
    )
  );

-- Also allow reading the client_plugins row for an installed plugin
drop policy if exists select_installed on app_public.client_plugins;
create policy select_installed on app_public.client_plugins
  for select using (
    id in (
      select ocp.client_plugin_id
        from app_public.organization_client_plugins ocp
       where ocp.organization_id in (select app_public.current_user_member_organization_ids())
    )
  );

--! split: 910-upsert-draft.sql
-- Helper for upsert
create function app_public.upsert_client_plugin_draft(
  client_plugin_id uuid,
  source jsonb,
  manifest jsonb
) returns app_public.client_plugin_drafts as $$
  insert into app_public.client_plugin_drafts (client_plugin_id, source, manifest)
  values (
    upsert_client_plugin_draft.client_plugin_id,
    upsert_client_plugin_draft.source,
    upsert_client_plugin_draft.manifest
  )
  on conflict (client_plugin_id)
  do update set
    source = excluded.source,
    manifest = excluded.manifest
  returning *;
$$ language sql volatile security invoker set search_path to pg_catalog, public, pg_temp;

comment on function app_public.upsert_client_plugin_draft(uuid, jsonb, jsonb) is
  E'Autosaves the owning organization''s shared draft for a client plugin';
