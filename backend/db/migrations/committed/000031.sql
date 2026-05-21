--! Previous: sha1:866165b89cc78112e7c5d82ac29564873f8d21c9
--! Hash: sha1:e721036a50430d798fd4827d62b817b3ada63ea2

--! split: 100-reset.sql
-- 400
drop function if exists app_public.create_organization(citext, text);
drop function if exists app_public.create_organization(citext, text, app_public.organization_type);

-- 300
alter table app_public.organizations
  drop column if exists organization_type;

-- 200
drop type if exists app_public.organization_type cascade;

--! split: 200-organization-type-enum.sql
create type app_public.organization_type as enum (
  'church',
  'venue'
);

--! split: 300-organization-type-column.sql
alter table app_public.organizations
  add column organization_type app_public.organization_type not null default 'venue';

-- Backfill: every row that existed before this column was added is a church.
update app_public.organizations
  set organization_type = 'church';

comment on column app_public.organizations.organization_type is
  E'The kind of organization this is (e.g. church, venue)';

grant update(organization_type) on app_public.organizations to :DATABASE_VISITOR;

--! split: 400-create-organization-fn.sql
create function app_public.create_organization(
  slug citext,
  name text,
  organization_type app_public.organization_type default 'venue'
) returns app_public.organizations as $$
declare
  v_org app_public.organizations;
begin
  if app_public.current_user_id() is null then
    raise exception 'You must log in to create an organization' using errcode = 'LOGIN';
  end if;
  insert into app_public.organizations (slug, name, organization_type)
    values (
      create_organization.slug,
      create_organization.name,
      create_organization.organization_type
    )
    returning * into v_org;
  insert into app_public.organization_memberships (organization_id, user_id, is_owner, is_billing_contact)
    values (v_org.id, app_public.current_user_id(), true, true);
  return v_org;
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;
