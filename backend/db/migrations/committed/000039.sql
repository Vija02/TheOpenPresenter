--! Previous: sha1:5d44c7a3d5d0f76c7e8298e6fa6cb903ccc96cda
--! Hash: sha1:c5bcf5347c9577685eb7e2f07f7060b380866311

--! split: 100-reset.sql
drop function if exists app_public.organizations_billing_info(app_public.organizations) cascade;
drop type if exists app_public.organization_billing_info cascade;

--! split: 900-billing-functions.sql
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
    case
      when coalesce(b.lifetime_room_count, 0) > 0 then 'business'
      else coalesce(b.plan, 'free')
    end::text,
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
  E'Current billing plan and Stripe subscription status for the organization. `plan` reflects effective entitlement, so a Lifetime purchase reads as ''business'' with no active subscription.';
