--! Previous: sha1:2b4723370cfc014bb5d3b35dea573f23081416ca
--! Hash: sha1:352a8a7074c3c6fa5c0f1abb7aed6ecc651e9334

--! split: 1-current.sql
-- Enter migration here

--! split: 100-create-organization-is-public.sql
-- Allow create_organization to set is_public up-front so the create form can
-- offer the choice instead of forcing a follow-up update.

drop function if exists app_public.create_organization(public.citext, text, app_public.organization_type);
drop function if exists app_public.create_organization(public.citext, text, app_public.organization_type, boolean);

create function app_public.create_organization(
  slug public.citext,
  name text,
  organization_type app_public.organization_type default 'venue'::app_public.organization_type,
  is_public boolean default false
) returns app_public.organizations
  language plpgsql security definer
  set search_path to 'pg_catalog', 'public', 'pg_temp'
  as $$
declare
  v_org app_public.organizations;
begin
  if app_public.current_user_id() is null then
    raise exception 'You must log in to create an organization' using errcode = 'LOGIN';
  end if;
  insert into app_public.organizations (slug, name, organization_type, is_public)
    values (
      create_organization.slug,
      create_organization.name,
      create_organization.organization_type,
      create_organization.is_public
    )
    returning * into v_org;
  insert into app_public.organization_memberships (organization_id, user_id, is_owner, is_billing_contact)
    values (v_org.id, app_public.current_user_id(), true, true);
  return v_org;
end;
$$;

revoke all on function app_public.create_organization(public.citext, text, app_public.organization_type, boolean) from public;
grant all on function app_public.create_organization(public.citext, text, app_public.organization_type, boolean) to :DATABASE_VISITOR;
