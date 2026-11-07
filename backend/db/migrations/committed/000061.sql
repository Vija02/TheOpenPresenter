--! Previous: sha1:b6b7bfde12acaf49a588478508ba62cc5bbd4e47
--! Hash: sha1:d290b2251f920321fee816049116dbee2862e0a7

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
drop view if exists app_private.sponsorship_applications_pending;
drop function if exists app_private.approve_sponsorship_application(uuid, interval, text);
drop function if exists app_private.decline_sponsorship_application(uuid, text);
drop function if exists app_private.decline_sponsorship_application(uuid, text, boolean);
drop function if exists app_public.apply_for_sponsorship(uuid, int, text, text);
drop function if exists app_public.organizations_sponsorship_application(app_public.organizations);
drop type if exists app_public.sponsorship_application_summary;
drop table if exists app_private.sponsorship_applications;

drop view if exists app_private.sponsorships_overview;
drop function if exists app_private.grant_sponsorship(citext, interval, text);
drop function if exists app_private.renew_sponsorship(citext, interval, text);
drop function if exists app_private.end_sponsorship(citext, text);
drop function if exists app_public.organizations_billing_info(app_public.organizations) cascade;
drop type if exists app_public.organization_billing_info cascade;
drop table if exists app_private.organization_sponsorships;

--! split: 300-organization-sponsorships.sql
/* Keep track of sponsored org */
create table app_private.organization_sponsorships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references app_public.organizations on delete cascade,
  started_at timestamptz not null default now(),
  review_at timestamptz not null,
  ended_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_at > started_at),
  check (ended_at is null or ended_at >= started_at)
);
alter table app_private.organization_sponsorships enable row level security;

create unique index organization_sponsorships_one_active_idx
  on app_private.organization_sponsorships (organization_id)
  where ended_at is null;

comment on table app_private.organization_sponsorships is
  E'Free Cloud plan granted to small churches. `review_at` is when we want to check in on it again; the sponsorship keeps working past that date until `ended_at` is set.';

/*
 * Start a sponsorship. Errors if the org already has an active one.
 * Usage: select * from app_private.grant_sponsorship('some-church', '12 months', 'Approx 30 people, applied by email');
 */
create function app_private.grant_sponsorship(
  org_slug citext,
  review_after interval default '12 months',
  note text default null
) returns app_private.organization_sponsorships
language plpgsql volatile
set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_org_id uuid;
  v_row app_private.organization_sponsorships;
begin
  select id into v_org_id from app_public.organizations where slug = org_slug;
  if v_org_id is null then
    raise exception 'No organization with slug "%"', org_slug using errcode = 'NTFND';
  end if;

  if exists (
    select 1 from app_private.organization_sponsorships
    where organization_id = v_org_id and ended_at is null
  ) then
    raise exception 'Organization "%" is already sponsored; use renew_sponsorship instead', org_slug
      using errcode = 'DUPOF';
  end if;

  insert into app_private.organization_sponsorships (organization_id, review_at, note)
  values (v_org_id, now() + review_after, grant_sponsorship.note)
  returning * into v_row;

  return v_row;
end;
$$;

create function app_private.renew_sponsorship(
  org_slug citext,
  review_after interval default '12 months',
  note text default null
) returns app_private.organization_sponsorships
language plpgsql volatile
set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_row app_private.organization_sponsorships;
begin
  update app_private.organization_sponsorships s
  set
    review_at = now() + review_after,
    note = case
      when renew_sponsorship.note is null then s.note
      when s.note is null then renew_sponsorship.note
      else s.note || E'\n' || renew_sponsorship.note
    end,
    updated_at = now()
  from app_public.organizations o
  where o.id = s.organization_id
    and o.slug = org_slug
    and s.ended_at is null
  returning s.* into v_row;

  if v_row.id is null then
    raise exception 'Organization "%" has no active sponsorship', org_slug using errcode = 'NTFND';
  end if;

  return v_row;
end;
$$;

create function app_private.end_sponsorship(
  org_slug citext,
  note text default null
) returns app_private.organization_sponsorships
language plpgsql volatile
set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_row app_private.organization_sponsorships;
begin
  update app_private.organization_sponsorships s
  set
    ended_at = now(),
    note = case
      when end_sponsorship.note is null then s.note
      when s.note is null then end_sponsorship.note
      else s.note || E'\n' || end_sponsorship.note
    end,
    updated_at = now()
  from app_public.organizations o
  where o.id = s.organization_id
    and o.slug = org_slug
    and s.ended_at is null
  returning s.* into v_row;

  if v_row.id is null then
    raise exception 'Organization "%" has no active sponsorship', org_slug using errcode = 'NTFND';
  end if;

  return v_row;
end;
$$;

/* Everything at a glance for admin */
create view app_private.sponsorships_overview as
  select
    o.slug,
    o.name,
    s.started_at,
    s.review_at,
    s.ended_at,
    (s.ended_at is null and s.review_at <= now()) as review_due,
    (
      select count(*) from app_public.organization_memberships m
      where m.organization_id = o.id
    ) as member_count,
    s.note,
    s.organization_id,
    s.id
  from app_private.organization_sponsorships s
  join app_public.organizations o on o.id = s.organization_id
  order by (s.ended_at is not null), s.review_at;

--! split: 400-sponsorship-applications.sql
/* Applications for the small-church sponsorship */
create table app_private.sponsorship_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references app_public.organizations on delete cascade,
  user_id uuid
    references app_public.users on delete set null,
  weekly_attendance int not null check (weekly_attendance > 0 and weekly_attendance < 100000),
  about_church text not null check (length(trim(about_church)) between 1 and 2000),
  intended_use text check (intended_use is null or length(intended_use) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table app_private.sponsorship_applications enable row level security;

create index on app_private.sponsorship_applications (organization_id);
create index on app_private.sponsorship_applications (user_id);
create unique index sponsorship_applications_one_pending_idx
  on app_private.sponsorship_applications (organization_id)
  where status = 'pending';

create trigger _500_notify
  after insert on app_private.sponsorship_applications
  for each row
  execute procedure app_private.tg__add_job('sponsorship_applications__notify');

-- Let the church know once we approve
create trigger _500_send_approved
  after update of status on app_private.sponsorship_applications
  for each row
  when (old.status is distinct from 'approved' and new.status = 'approved')
  execute procedure app_private.tg__add_job('sponsorship_applications__send_approved');

create function app_public.apply_for_sponsorship(
  organization_id uuid,
  weekly_attendance int,
  about_church text,
  intended_use text default null
) returns boolean
language plpgsql volatile security definer
set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_user app_public.users;
begin
  if app_public.current_user_id() is null then
    raise exception 'You must log in to apply' using errcode = 'LOGIN';
  end if;

  select * into v_user from app_public.users where id = app_public.current_user_id();
  if not v_user.is_verified then
    raise exception 'Please verify your email address before applying' using errcode = 'VRFY2';
  end if;

  if not exists (
    select 1 from app_public.organization_memberships m
    where m.organization_id = apply_for_sponsorship.organization_id
      and m.user_id = v_user.id
      and (m.is_owner or m.is_billing_contact)
  ) then
    raise exception 'Only the organization owner or billing contact can apply' using errcode = 'DNIED';
  end if;

  if exists (
    select 1 from app_private.organization_sponsorships s
    where s.organization_id = apply_for_sponsorship.organization_id
      and s.ended_at is null
  ) then
    raise exception 'This organization is already sponsored' using errcode = 'DUPOF';
  end if;

  if exists (
    select 1 from app_private.sponsorship_applications a
    where a.organization_id = apply_for_sponsorship.organization_id
      and a.status = 'pending'
  ) then
    raise exception 'You already have an application waiting for review' using errcode = 'DUPOF';
  end if;

  if about_church is null or length(trim(about_church)) = 0 then
    raise exception 'Please tell us a little about your church' using errcode = 'CHECK';
  end if;

  insert into app_private.sponsorship_applications
    (organization_id, user_id, weekly_attendance, about_church, intended_use)
  values (
    apply_for_sponsorship.organization_id,
    v_user.id,
    apply_for_sponsorship.weekly_attendance,
    trim(apply_for_sponsorship.about_church),
    nullif(trim(apply_for_sponsorship.intended_use), '')
  );

  return true;
end;
$$;

grant execute on function app_public.apply_for_sponsorship(uuid, int, text, text) to :DATABASE_VISITOR;

comment on function app_public.apply_for_sponsorship(uuid, int, text, text) is
  E'Apply for the small-church sponsorship (a free Cloud plan). Only the organization owner or billing contact can apply.';

/*
 * What members see: the status of the latest application, if any.
 */
create type app_public.sponsorship_application_summary as (
  status text,
  submitted_at timestamptz,
  decided_at timestamptz
);

create function app_public.organizations_sponsorship_application(org app_public.organizations)
returns app_public.sponsorship_application_summary
language sql stable security definer
set search_path to pg_catalog, public, pg_temp
as $$
  select a.status, a.created_at, a.decided_at
  from app_private.sponsorship_applications a
  where a.organization_id = org.id
    and org.id in (select app_public.current_user_member_organization_ids())
  -- A pending application always wins, otherwise the most recent decision
  order by (a.status = 'pending') desc, a.created_at desc
  limit 1;
$$;

grant execute on function app_public.organizations_sponsorship_application(app_public.organizations) to :DATABASE_VISITOR;

comment on function app_public.organizations_sponsorship_application(app_public.organizations) is
  E'The latest sponsorship application for this organization, if any.';

/*
 * Admin: approve an application. Starts the sponsorship and records the decision.
 * Usage: select * from app_private.approve_sponsorship_application('<application id>');
 */
create function app_private.approve_sponsorship_application(
  application_id uuid,
  review_after interval default '12 months',
  note text default null
) returns app_private.organization_sponsorships
language plpgsql volatile
set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_app app_private.sponsorship_applications;
  v_slug citext;
  v_row app_private.organization_sponsorships;
begin
  select * into v_app from app_private.sponsorship_applications where id = application_id;
  if v_app.id is null then
    raise exception 'No application with id "%"', application_id using errcode = 'NTFND';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Application is already %', v_app.status using errcode = 'DUPOF';
  end if;

  select slug into v_slug from app_public.organizations where id = v_app.organization_id;

  v_row := app_private.grant_sponsorship(
    v_slug,
    review_after,
    coalesce(note, 'Applied with ~' || v_app.weekly_attendance || ' weekly attendance')
  );

  update app_private.sponsorship_applications
  set status = 'approved', decided_at = now(), decision_note = note
  where id = application_id;

  return v_row;
end;
$$;

create function app_private.decline_sponsorship_application(
  application_id uuid,
  note text default null,
  send_email boolean default true
) returns app_private.sponsorship_applications
language plpgsql volatile
set search_path to pg_catalog, public, pg_temp
as $$
declare
  v_app app_private.sponsorship_applications;
begin
  update app_private.sponsorship_applications
  set status = 'declined', decided_at = now(), decision_note = note
  where id = application_id and status = 'pending'
  returning * into v_app;

  if v_app.id is null then
    raise exception 'No pending application with id "%"', application_id using errcode = 'NTFND';
  end if;

  if send_email then
    perform graphile_worker.add_job(
      'sponsorship_applications__send_declined',
      json_build_object('id', v_app.id)
    );
  end if;

  return v_app;
end;
$$;

/* Admin: applications waiting for a decision, oldest first. */
create view app_private.sponsorship_applications_pending as
  select
    a.id,
    o.slug,
    o.name,
    a.weekly_attendance,
    a.about_church,
    a.intended_use,
    u.name as applicant_name,
    app_public.users_primary_email(u) as applicant_email,
    (
      select count(*) from app_public.organization_memberships m
      where m.organization_id = o.id
    ) as member_count,
    a.created_at
  from app_private.sponsorship_applications a
  join app_public.organizations o on o.id = a.organization_id
  left join app_public.users u on u.id = a.user_id
  where a.status = 'pending'
  order by a.created_at;

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
  effective_room_count  int,
  is_sponsored          boolean
);

create function app_public.organizations_billing_info(org app_public.organizations)
returns app_public.organization_billing_info
language sql stable security definer
set search_path to pg_catalog, public, pg_temp
as $$
  select
    case
      when coalesce(b.lifetime_room_count, 0) > 0 then 'business'
      when sp.id is not null then 'business'
      else coalesce(b.plan, 'free')
    end::text,
    b.stripe_subscription_status,
    b.stripe_current_period_end,
    coalesce(b.subscribed_room_count, 0),
    coalesce(b.billing_interval, 'month')::text,
    coalesce(b.cancel_at_period_end, false),
    b.cancel_at,
    coalesce(b.lifetime_room_count, 0),
    greatest(
      coalesce(b.subscribed_room_count, 0) + coalesce(b.lifetime_room_count, 0),
      case when sp.id is not null then 1 else 0 end
    ),
    sp.id is not null
  from app_public.organizations o
  left join app_private.organization_billing b on b.organization_id = o.id
  left join app_private.organization_sponsorships sp
    on sp.organization_id = o.id and sp.ended_at is null
  where o.id = org.id
    and o.id in (
      select app_public.current_user_member_organization_ids()
    );
$$;

grant execute on function app_public.organizations_billing_info(app_public.organizations) to :DATABASE_VISITOR;

comment on function app_public.organizations_billing_info(app_public.organizations) is
  E'Current billing plan and Stripe subscription status for the organization. `plan` reflects effective entitlement, so a Lifetime purchase or an active sponsorship reads as ''business'' with no active subscription.';
