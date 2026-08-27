--! Previous: sha1:90643e965e0330547efd88bde358ebe91d02163c
--! Hash: sha1:6c773b6bc754e7932efa6ea3c6f75bf5a7c60c46

--! split: 1-current.sql
-- Enter migration here

--! split: 100-generate-unique-username.sql
-- Username is no longer collected at registration; it is derived server-side.
-- This extracts the sanitise-and-uniquify logic that previously lived inline in
-- app_private.register_user so both the OAuth path and the email/password path
-- share one implementation.

create or replace function app_private.generate_unique_username(base text)
returns citext as $$
declare
  v_username citext = base;
begin
  if v_username is null then
    v_username = 'user';
  end if;

  v_username = regexp_replace(v_username, '^[^a-z]+', '', 'gi');
  v_username = regexp_replace(v_username, '[^a-z0-9]+', '_', 'gi');

  if v_username is null or length(v_username) < 3 then
    v_username = 'user';
  end if;

  if length(v_username) > 20 then
    v_username = substring(v_username from 1 for 20);
  end if;

  select (
    case
    when i = 0 then v_username
    else v_username || i::text
    end
  ) into v_username from generate_series(0, 1000) i
  where not exists(
    select 1
    from app_public.users
    where users.username = (
      case
      when i = 0 then v_username
      else v_username || i::text
      end
    )
  )
  limit 1;

  return v_username;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

comment on function app_private.generate_unique_username(base text) is
  E'Sanitises the given string into a valid username, appending a discriminator if needed to make it unique.';

--! split: 200-register-user-shared-username.sql
-- Re-create app_private.register_user (OAuth path) so the username sanitising
-- lives in app_private.generate_unique_username rather than being duplicated
-- inline here. Behaviour is unchanged.

create or replace function app_private.register_user(
  f_service character varying,
  f_identifier character varying,
  f_profile json,
  f_auth_details json,
  f_email_is_verified boolean default false
) returns app_public.users as $$
declare
  v_user app_public.users;
  v_email citext;
  v_name text;
  v_username citext;
  v_avatar_url text;
  v_user_authentication_id uuid;
begin
  -- Extract data from the user's OAuth profile data.
  v_email := f_profile ->> 'email';
  v_name := f_profile ->> 'name';
  v_username := f_profile ->> 'username';
  v_avatar_url := f_profile ->> 'avatar_url';

  v_username = app_private.generate_unique_username(
    coalesce(v_username, v_name, 'user')
  );

  -- Create the user account
  v_user = app_private.really_create_user(
    username => v_username,
    email => v_email,
    email_is_verified => f_email_is_verified,
    name => v_name,
    avatar_url => v_avatar_url
  );

  -- Insert the user's private account data (e.g. OAuth tokens)
  insert into app_public.user_authentications (user_id, service, identifier, details) values
    (v_user.id, f_service, f_identifier, f_profile) returning id into v_user_authentication_id;
  insert into app_private.user_authentication_secrets (user_authentication_id, details) values
    (v_user_authentication_id, f_auth_details);

  return v_user;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

comment on function app_private.register_user(f_service character varying, f_identifier character varying, f_profile json, f_auth_details json, f_email_is_verified boolean) is
  E'Used to register a user from information gleaned from OAuth. Primarily used by link_or_register_user';
