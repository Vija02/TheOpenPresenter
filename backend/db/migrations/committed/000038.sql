--! Previous: sha1:8b8b0001917a853437f878f21aa801cf2f07c16d
--! Hash: sha1:5d44c7a3d5d0f76c7e8298e6fa6cb903ccc96cda

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
-- 900
drop function if exists app_public.organizations_billing_info(app_public.organizations) cascade;
drop type if exists app_public.organization_billing_info cascade;

-- 500
drop table if exists app_private.organization_lifetime_purchases cascade;

-- 300
alter table app_private.organization_billing
  drop column if exists lifetime_room_count;

--! split: 300-lifetime-columns.sql
-- Rooms owned outright via one-time Lifetime purchases
alter table app_private.organization_billing
  add column lifetime_room_count int not null default 0;

--! split: 500-lifetime-purchases.sql
-- Keep this info for record & idempotency
create table app_private.organization_lifetime_purchases (
  stripe_checkout_session_id  text primary key,
  organization_id             uuid not null references app_public.organizations(id) on delete cascade,
  stripe_payment_intent_id    text,
  quantity                    int not null,
  amount_total                int,
  currency                    text,
  created_at                  timestamptz not null default now()
);

create index on app_private.organization_lifetime_purchases (organization_id);

--! split: 900-billing-functions.sql
-- This re-creates the type with lifetime data
create type app_public.organization_billing_info as (
  plan                  text,
  subscription_status   text,
  current_period_end    timestamptz,
  subscribed_room_count int,
  billing_interval      text,
  cancel_at_period_end  boolean,
  cancel_at             timestamptz,
  lifetime_room_count   int,
  effective_room_count  int
);

create function app_public.organizations_billing_info(org app_public.organizations)
returns app_public.organization_billing_info
language sql stable security definer
set search_path to pg_catalog, public, pg_temp
as $$
  select
    coalesce(b.plan, 'free')::text,
    b.stripe_subscription_status,
    b.stripe_current_period_end,
    coalesce(b.subscribed_room_count, 0),
    coalesce(b.billing_interval, 'month')::text,
    coalesce(b.cancel_at_period_end, false),
    b.cancel_at,
    coalesce(b.lifetime_room_count, 0),
    coalesce(b.subscribed_room_count, 0) + coalesce(b.lifetime_room_count, 0)
  from app_public.organizations o
  left join app_private.organization_billing b on b.organization_id = o.id
  where o.id = org.id
    and o.id in (
      select app_public.current_user_member_organization_ids()
    );
$$;

grant execute on function app_public.organizations_billing_info(app_public.organizations) to :DATABASE_VISITOR;

comment on function app_public.organizations_billing_info(app_public.organizations) is
  E'Current billing plan and Stripe subscription status for the organization.';
