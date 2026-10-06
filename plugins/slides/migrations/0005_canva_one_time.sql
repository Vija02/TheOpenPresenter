-- ---------------------------------------------------------------------------
-- One-time Canva sign-ins
-- ---------------------------------------------------------------------------
alter table canva_oauth_state
  add column if not exists is_one_time boolean not null default false;

alter table canva_oauth_state
  add column if not exists grant_id uuid;

create table if not exists canva_one_time_grant (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references app_public.organizations (id) on delete cascade,
  user_id uuid
    references app_public.users (id) on delete cascade,
  upload_link_id uuid
    references upload_link (id) on delete cascade,

  access_token text not null,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint canva_one_time_grant_owner
    check ((user_id is null) <> (upload_link_id is null))
);

create index if not exists canva_one_time_grant_expires_at_idx
  on canva_one_time_grant (expires_at);

create index if not exists canva_one_time_grant_upload_link_id_idx
  on canva_one_time_grant (upload_link_id);

alter table canva_one_time_grant enable row level security;

-- ---------------------------------------------------------------------------
-- Upload-link visitors used to get a full canva_connection in the link's
-- organization. Remove them all, visitors now get grants.
-- ---------------------------------------------------------------------------
delete from canva_connection where created_via_upload_link_id is not null;

alter table canva_connection drop column if exists created_via_upload_link_id;
