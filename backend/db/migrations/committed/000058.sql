--! Previous: sha1:c7e6be1748f7b26ee8e430c31219ed1e3f72708f
--! Hash: sha1:c4638f9d894f92892387d63236287924c90d3bed

--! split: 100-reset.sql
drop function if exists app_public.invitation_preview(uuid, text) cascade;
drop type if exists app_public.invitation_preview cascade;

--! split: 900-invitation-preview.sql
create type app_public.invitation_preview as (
  organization_name text,
  email             citext,
  has_account       boolean
);

-- Usable while logged out so the accept page can tailor the sign up step
create function app_public.invitation_preview(invitation_id uuid, code text default null)
  returns app_public.invitation_preview
as $$
declare
  v_invitation app_public.organization_invitations;
  v_result app_public.invitation_preview;
begin
  select * into v_invitation from app_public.organization_invitations where id = invitation_id;

  if v_invitation is null then
    return null;
  end if;

  if v_invitation.user_id is null and v_invitation.code is distinct from invitation_preview.code then
    return null;
  end if;

  select name into v_result.organization_name
    from app_public.organizations where id = v_invitation.organization_id;

  if v_invitation.user_id is not null then
    v_result.has_account = true;
  else
    v_result.email = v_invitation.email;
    v_result.has_account = exists(
      select 1 from app_public.user_emails where user_emails.email = v_invitation.email
    );
  end if;

  return v_result;
end;
$$ language plpgsql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_public.invitation_preview(uuid, text) to :DATABASE_VISITOR;

comment on function app_public.invitation_preview(uuid, text) is
  E'Public summary of an invitation so the invitee can be guided to sign in or sign up. Returns null when the invitation or code does not match.';

-- The emailed code proves ownership of the invited address, so verify it if the user has it
create or replace function app_public.accept_invitation_to_organization(invitation_id uuid, code text default null)
  returns void
as $$
declare
  v_organization app_public.organizations;
  v_email citext;
begin
  v_organization = app_public.organization_for_invitation(invitation_id, code);

  select email into v_email from app_public.organization_invitations where id = invitation_id;

  -- Accept the user into the organization
  insert into app_public.organization_memberships (organization_id, user_id)
    values(v_organization.id, app_public.current_user_id())
    on conflict do nothing;

  if v_email is not null then
    update app_public.user_emails
    set
      is_verified = true,
      is_primary = is_primary or not exists(
        select 1 from app_public.user_emails other_email where other_email.user_id = user_emails.user_id and other_email.is_primary is true
      )
    where user_id = app_public.current_user_id()
    and email = v_email
    and is_verified is false
    and not exists(
      select 1 from app_public.user_emails other_email where other_email.email = v_email and other_email.is_verified is true
    );
  end if;

  -- Delete the invitation
  delete from app_public.organization_invitations where id = invitation_id;
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;
