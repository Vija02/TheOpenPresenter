--! Previous: sha1:fe9dd350f7c646a2a5f1dc3dc648ead4e8e3335e
--! Hash: sha1:971681ff51d76229a367a109d22928f0a3ffcc55

--! split: 100-reset.sql
-- 200
drop function if exists app_public.current_user_can_access_screen(uuid) cascade;
drop table if exists app_public.screens cascade;

--! split: 200-screen-table.sql
create table app_public.screens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  name text not null,
  slug citext not null,

  -- Current assignment
  current_project_id uuid null references app_public.projects(id) on delete set null,
  current_renderer_id text not null default '1',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, slug)
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.screens (organization_id);
create index on app_public.screens (current_project_id);
create index on app_public.screens (slug);
create index on app_public.screens ("name");

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.screens
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.screens enable row level security;
-- Policies
create policy select_own on app_public.screens
  for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own on app_public.screens
  for insert with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own on app_public.screens
  for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own on app_public.screens
  for delete using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.screens to :DATABASE_VISITOR;
grant insert(organization_id, name, slug, current_project_id, current_renderer_id) on app_public.screens to :DATABASE_VISITOR;
grant update(name, slug, current_project_id, current_renderer_id) on app_public.screens to :DATABASE_VISITOR;
grant delete on app_public.screens to :DATABASE_VISITOR;

/*====================================*/
/*============= COMMENTS =============*/
/*====================================*/
comment on table app_public.screens is
  E'A persistent display identity in an organization. Configured once on the device, then any project can be assigned to it remotely.';
comment on column app_public.screens.current_project_id is
  E'Project currently shown on this screen, or NULL if idle.';
comment on column app_public.screens.current_renderer_id is
  E'Which renderer slot inside the assigned project to render.';

/*====================================*/
/*============= TRIGGERS =============*/
/*====================================*/
create trigger _500_gql_notify
  after insert or update or delete on app_public.screens
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'screenUpdate',
    'graphql:screens:$1',
    'id'
  );

create function app_public.current_user_can_access_screen(screen_id uuid) returns boolean as $$
  select exists(
    select 1
    from app_public.screens
    where id = screen_id
      and organization_id in (select app_public.current_user_member_organization_ids())
  );
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;
