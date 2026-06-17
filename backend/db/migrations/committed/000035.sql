--! Previous: sha1:4e30346d4f69127d02e45e885e4d4ec051a19656
--! Hash: sha1:9dfdc39c037c6e748a3bc3d35dd8f102af585bdb

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
-- 900
drop function if exists app_public.organizations_billing_info(app_public.organizations) cascade;
drop type if exists app_public.organization_billing_info cascade;

-- 200
drop table if exists app_private.organization_billing cascade;

--! split: 200-billing.sql
create table app_private.organization_billing (
  organization_id uuid primary key references app_public.organizations(id) on delete cascade,
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  -- Stripe subscription status: active, trialing, past_due, canceled, incomplete, incomplete_expired, unpaid, paused
  stripe_subscription_status text,
  stripe_price_id       text,
  stripe_current_period_end timestamptz,
  -- Logical plan stored here so the app can check it without hitting Stripe
  plan                  text not null default 'free',
  -- Number of rooms the subscription covers (Stripe subscription quantity)
  subscribed_room_count int not null default 0,
  -- 'month' or 'year'
  billing_interval      text not null default 'month',
  -- Whether the subscription is scheduled to cancel at period end
  cancel_at_period_end  boolean not null default false,
  -- When the subscription is scheduled to cancel (null unless scheduled)
  cancel_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger _100_timestamps
  before insert or update on app_private.organization_billing
  for each row execute procedure app_private.tg__timestamps();

--! split: 900-billing-functions.sql
create type app_public.organization_billing_info as (
  plan                  text,
  subscription_status   text,
  current_period_end    timestamptz,
  subscribed_room_count int,
  billing_interval      text,
  cancel_at_period_end  boolean,
  cancel_at             timestamptz
);

-- Computed column: organizationBySlug { billingInfo { plan subscriptionStatus currentPeriodEnd subscribedRoomCount billingInterval } }
-- Only returns data when the current user is a member of the organization.
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
    b.cancel_at
  from app_public.organizations o
  left join app_private.organization_billing b on b.organization_id = o.id
  where o.id = org.id
    and o.id in (
      select app_public.current_user_member_organization_ids()
    );
$$;

comment on function app_public.organizations_billing_info(app_public.organizations) is
  E'Current billing plan and Stripe subscription status for the organization.';
