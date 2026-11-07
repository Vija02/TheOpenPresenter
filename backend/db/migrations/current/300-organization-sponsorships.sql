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
