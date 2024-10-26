--! Previous: sha1:f546e68f46b72be4e85e868e54fce9de954c6fdf
--! Hash: sha1:47555000cf9236e4ef0b0a1ed4c782170432e69f

--! split: 100-drop.sql
drop policy if exists select_public on app_public.organizations;

drop index if exists organizations_is_public_idx;

ALTER TABLE app_public.organizations
  DROP COLUMN IF EXISTS is_public;

drop table if exists app_public.organization_join_requests;

drop function if exists app_public.organizations_public_search(text) cascade;

--! split: 200-current.sql
/*
 * When a user requests access to an organization, a record will be added to this
 * table. Once the request is accepted, the record will be deleted.
 */
create table app_public.organization_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app_public.organizations on delete cascade,
  user_id uuid references app_public.users on delete cascade,
  unique (organization_id, user_id)
);
alter table app_public.organization_join_requests enable row level security;

create index on app_public.organization_join_requests(organization_id);
create index on app_public.organization_join_requests(user_id);

grant select on app_public.organization_join_requests to :DATABASE_VISITOR;

create policy select_organization on app_public.organization_join_requests for select using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Send the organization owner a request email
create trigger _500_send_email after insert on app_public.organization_join_requests
  for each row execute procedure app_private.tg__add_job('organization_join_requests__send_request');

/*
 * This function allows you to request yourself to be invited to an organization
 */
create or replace function app_public.request_join_to_organization(organization_id uuid)
  returns void as $$
declare
  v_user app_public.users;
begin
  -- Are we logged in
  if app_public.current_user_id() is null then
    raise exception 'You must log in to request to join an organization' using errcode = 'LOGIN';
  end if;

  select * into v_user from app_public.users where id = app_public.current_user_id();

  if not v_user.is_verified then
    raise exception 'You must verify your account to request to join an organization' using errcode = 'VRFY2';
  end if;

  if exists(
    select 1 from app_public.organization_memberships
      where organization_memberships.organization_id = request_join_to_organization.organization_id
      and organization_memberships.user_id = app_public.current_user_id()
  ) then
    raise exception 'Cannot join this organization since user is already a member' using errcode = 'ISMBR';
  end if;

  -- Request to join
  insert into app_public.organization_join_requests(organization_id, user_id)
    values (request_join_to_organization.organization_id, app_public.current_user_id());
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;

/*
 * This function accepts a request to join the organization and adds the user to
 * the organization (deleting the request). 
 */
create or replace function app_public.accept_join_request_to_organization(request_id uuid)
  returns void as $$
declare
  v_request app_public.organization_join_requests;
begin
  select * into v_request from app_public.organization_join_requests where id = request_id;

  if not exists(
    select 1 from app_public.organization_memberships
      where organization_memberships.organization_id = v_request.organization_id
      and organization_memberships.user_id = app_public.current_user_id()
      and is_owner is true
  ) then
    raise exception 'You''re not the owner of this organization' using errcode = 'DNIED';
  end if;

  -- Accept the user into the organization
  insert into app_public.organization_memberships (organization_id, user_id)
    values(v_request.organization_id, v_request.user_id)
    on conflict do nothing;

  -- Delete the join request
  delete from app_public.organization_join_requests where id = request_id;

  perform graphile_worker.add_job(
    'organization_join_requests__send_request_accepted',
    json_build_object('organization_id', v_request.organization_id, 'user_id', v_request.user_id)
  );
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;

-- Add a is_public column to know whether organization can be searched or not
ALTER TABLE app_public.organizations
  ADD COLUMN is_public boolean default false;

-- Index for better search performance
create index on "app_public"."organizations"("is_public");

create or replace function app_public.organizations_public_search(search_string text) returns setof app_public.organizations as $$
  select * from app_public.organizations o where o.is_public is true AND o.name ILIKE '%' || search_string || '%';
$$ language sql stable;

-- Allow any user to access organization info if it's public
create policy select_public on app_public.organizations for select using (is_public is true);
