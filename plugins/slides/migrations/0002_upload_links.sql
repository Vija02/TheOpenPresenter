-- ---------------------------------------------------------------------------
-- Public upload links.
-- Anyone holding the URL can upload slides into that scene without an account.
-- ---------------------------------------------------------------------------
create table if not exists upload_link (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,
  project_id uuid not null
    references app_public.projects (id) on delete cascade,
  scene_id text not null,
  plugin_id text not null,

  -- URL-safe random token
  token text not null unique,

  label text,

  max_attempts int,
  attempt_count int not null default 0,

  expires_at timestamptz,
  is_active boolean not null default true,

  created_by_user_id uuid
    references app_public.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists upload_link_organization_id_idx
  on upload_link (organization_id);
create index if not exists upload_link_project_id_idx
  on upload_link (project_id);
create index if not exists upload_link_plugin_id_idx
  on upload_link (plugin_id);

create or replace trigger _100_timestamps
  before insert or update on upload_link
  for each row
  execute procedure app_private.tg__timestamps();

grant select on upload_link to :DATABASE_VISITOR;

alter table upload_link enable row level security;

create policy select_own_org on upload_link for select
  using (organization_id in (select app_public.current_user_member_organization_ids()));

-- ---------------------------------------------------------------------------
-- Uploads received through a link.
-- Replaced uploads are kept for the audit trail.
-- ---------------------------------------------------------------------------
create table if not exists upload_link_upload (
  id uuid primary key default gen_random_uuid(),

  upload_link_id uuid not null
    references upload_link (id) on delete cascade,

  media_id uuid
    references app_public.medias (id) on delete set null,

  original_name text,
  uploader_name text,

  import_id text,

  -- Keep for preview
  thumbnail_media_names text[],

  replaced_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists upload_link_upload_link_id_idx
  on upload_link_upload (upload_link_id);
create index if not exists upload_link_upload_media_id_idx
  on upload_link_upload (media_id);
create index if not exists upload_link_upload_created_at_idx
  on upload_link_upload (created_at);

grant select on upload_link_upload to :DATABASE_VISITOR;

alter table upload_link_upload enable row level security;

create policy select_own_org on upload_link_upload for select
  using (
    upload_link_id in (
      select id from upload_link
      where organization_id in (select app_public.current_user_member_organization_ids())
    )
  );

-- The upload currently living in the scene. Added after upload_link_upload exists so the reference resolves.
alter table upload_link
  add column if not exists current_upload_id uuid
    references upload_link_upload (id) on delete set null;

create index if not exists upload_link_current_upload_id_idx
  on upload_link (current_upload_id);
