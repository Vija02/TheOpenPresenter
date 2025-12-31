--! Previous: sha1:44f109ffe59b6c3bd1e9610b53f3926cdfa215cc
--! Hash: sha1:2a7818516087a6e95fad543016d58b2aec53b34e

--! split: 100-reset.sql
-- 400
drop trigger if exists _500_gql_notify on app_public.cloud_connections cascade;

-- 300
drop table if exists app_public.organization_active_devices;

-- 200
drop function if exists app_public.current_user_can_access_cloud_connection(uuid) cascade;

--! split: 200-cloud_connection-access.sql
create function app_public.current_user_can_access_cloud_connection(cloud_connection_id uuid) returns boolean as $$
  select exists(select 1 from app_public.cloud_connections where id = cloud_connection_id and organization_id in (select app_public.current_user_member_organization_ids()));
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

--! split: 300-organization_active_devices.sql
-- Create table for cloud connection active devices
create table app_public.organization_active_devices (
  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  iroh_endpoint_id text not null,

  iroh_ticket text not null,
  active_project_ids text[] not null default '{}',

  updated_at timestamptz not null default now()
);
/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on "app_public"."organization_active_devices"("organization_id");
create unique index on "app_public"."organization_active_devices"("organization_id", "iroh_endpoint_id");
-- Index this because we want to run queries to get devices that are only recently active
create index on "app_public"."organization_active_devices"("updated_at");

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.organization_active_devices enable row level security;
-- Policies
create policy select_own on app_public.organization_active_devices for select using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy insert_own ON app_public.organization_active_devices for insert with check (organization_id in (select app_public.current_user_member_organization_ids()));
create policy update_own on app_public.organization_active_devices for update using (organization_id in (select app_public.current_user_member_organization_ids()));
create policy delete_own on app_public.organization_active_devices for delete using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.organization_active_devices to :DATABASE_VISITOR;
grant insert(organization_id, iroh_endpoint_id, iroh_ticket, active_project_ids, updated_at) on app_public.organization_active_devices to :DATABASE_VISITOR;
grant update(iroh_ticket, active_project_ids, updated_at) on app_public.organization_active_devices to :DATABASE_VISITOR;
grant delete on app_public.organization_active_devices to :DATABASE_VISITOR;

--! split: 400-cloud_connections_notify.sql
create trigger _500_gql_notify
  after insert or update or delete on app_public.cloud_connections
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'cloudConnectionUpdate',
    'graphql:cloud_connections'
  );
