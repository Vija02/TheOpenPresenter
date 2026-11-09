--! Previous: sha1:d290b2251f920321fee816049116dbee2862e0a7
--! Hash: sha1:0bf092cb755d48ab98698ba70d685d4971082499

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
drop function if exists app_private.grant_sponsorship(citext, interval, text, boolean);
drop function if exists app_private.grant_sponsorship(citext, interval, text);

--! split: 300-grant-sponsorship-email.sql
/*
 * Start a sponsorship. Errors if the org already has an active one.
 * send_email: email the org owner the approval email. Use this for churches that
 * applied by email. Off by default because approve_sponsorship_application
 * sends its own email to the applicant.
 * Usage: select * from app_private.grant_sponsorship('some-church', '12 months', 'Applied by email', true);
 */
create function app_private.grant_sponsorship(
  org_slug citext,
  review_after interval default '12 months',
  note text default null,
  send_email boolean default false
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

  if send_email then
    perform graphile_worker.add_job(
      'organization_sponsorships__send_approved',
      json_build_object('id', v_row.id)
    );
  end if;

  return v_row;
end;
$$;
