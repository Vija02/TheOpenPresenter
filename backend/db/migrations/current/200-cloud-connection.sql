-- Create table for cloud connections
create table app_public.cloud_connections (
  id uuid primary key default uuid_generate_v7(),
  organization_id uuid not null references app_public.organizations(id) on delete cascade,

  host text not null,
  session_cookie text not null,
  session_cookie_expiry timestamptz not null,

  target_organization_slug text null,

  sync_all boolean default false,

  creator_user_id uuid null references app_public.users("id") on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index on "app_public"."cloud_connections"("organization_id");
create index on "app_public"."cloud_connections"("creator_user_id");
create index on "app_public"."cloud_connections"("created_at");

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.cloud_connections
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.cloud_connections enable row level security;
-- Policies
create policy select_own on app_public.cloud_connections for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own_org on app_public.cloud_connections for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_only_when_empty on app_public.cloud_connections for update using (target_organization_slug is null);
create policy delete_own on app_public.cloud_connections for delete using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.cloud_connections to :DATABASE_VISITOR;
grant update(target_organization_slug) on app_public.cloud_connections to :DATABASE_VISITOR;
grant delete on app_public.cloud_connections to :DATABASE_VISITOR;
