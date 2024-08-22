--! Previous: sha1:eaf2866060caa0bba319236017c15a40d37a7815
--! Hash: sha1:b17518d457743a899f6f2417913f309e09bf4c39

--! split: 1-reset.sql
-- 200
drop table if exists app_public.projects;
-- 100
drop function if exists app_public.users_primary_email(users) cascade;

--! split: 100-utils.sql
/*
 * COMPUTED COLUMN - Get the user's primary email
 */
create function app_public.users_primary_email(users users) returns text as $$
  select email from app_public.user_emails where user_id = users.id and is_primary = true
$$ language sql stable;

--! split: 200-projects.sql
create table app_public.projects (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  creator_user_id uuid null references app_public.users("id") on delete set null,

  slug citext not null,

  document bytea null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, slug)
);

create index on "app_public"."projects"("organization_id");
create index on "app_public"."projects"("creator_user_id");
create index on "app_public"."projects"("slug");
create index on "app_public"."projects"("updated_at");

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.projects
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.projects enable row level security;
-- Policies
create policy select_own on app_public.projects for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_org on app_public.projects for insert with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own_creator on app_public.projects for insert with check (creator_user_id = app_public.current_user_id());

-- Grants
grant select on app_public.projects to :DATABASE_VISITOR;
grant insert(organization_id, creator_user_id, slug) on app_public.projects to :DATABASE_VISITOR;
