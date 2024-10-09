--! Previous: sha1:b17518d457743a899f6f2417913f309e09bf4c39
--! Hash: sha1:ecbfd32a05b31ad04ca5ba0fa5af1001e811880c

--! split: 1-reset.sql
-- 100
drop table if exists app_public.medias;

--! split: 50-extension.sql
CREATE EXTENSION IF NOT EXISTS pg_uuidv7 WITH SCHEMA public;

--! split: 100-media.sql
create table app_public.medias (
  id uuid primary key default uuid_generate_v7(),

  -- The name of the stored file
  media_name text not null,

  -- Metadata
  file_size bigint null,
  file_offset int not null,

  -- Extra data
  original_name text null,
  file_extension text null,

  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  creator_user_id uuid null references app_public.users("id") on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on "app_public"."medias"("organization_id");
create index on "app_public"."medias"("creator_user_id");
create index on "app_public"."medias"("created_at");

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.medias
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.medias enable row level security;
-- Policies
create policy select_own on app_public.medias for select using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.medias to :DATABASE_VISITOR;
