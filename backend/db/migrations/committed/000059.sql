--! Previous: sha1:c4638f9d894f92892387d63236287924c90d3bed
--! Hash: sha1:65105fc02ace6a64b7ca64af7981869bced52823

--! split: 1-current.sql
-- Enter migration here

--! split: 100-reset.sql
drop function if exists app_private.claim_unverified_account(uuid, citext) cascade;
drop trigger if exists _200_clear_password_reset_required on app_private.user_secrets;
drop function if exists app_private.tg_user_secrets__clear_password_reset_required() cascade;
alter table app_private.user_secrets drop column if exists password_reset_required;

--! split: 300-password-reset-required.sql
-- Set when an OAuth sign in claims an account whose email was never verified;
-- whoever chose that password may not be the email's owner
alter table app_private.user_secrets
  add column password_reset_required boolean not null default false;

create function app_private.tg_user_secrets__clear_password_reset_required() returns trigger as $$
begin
  if new.password_hash is distinct from old.password_hash then
    new.password_reset_required = false;
  end if;
  return new;
end;
$$ language plpgsql volatile set search_path = pg_catalog, public, pg_temp;

create trigger _200_clear_password_reset_required
  before update on app_private.user_secrets
  for each row execute procedure app_private.tg_user_secrets__clear_password_reset_required();

--! split: 800-user-emails-policy.sql
-- Unverified accounts may be squatting on someone else's email, so they can't
-- attach anything that would survive the real owner claiming it
drop policy if exists insert_own on app_public.user_emails;
create policy insert_own on app_public.user_emails for insert with check (
  user_id = app_public.current_user_id()
  and exists(select 1 from app_public.users where id = app_public.current_user_id() and is_verified is true)
);

--! split: 910-oauth-claim-unverified-account.sql
create or replace function app_private.login(username citext, password text) returns app_private.sessions as $$
declare
  v_user app_public.users;
  v_user_secret app_private.user_secrets;
  v_login_attempt_window_duration interval = interval '5 minutes';
  v_session app_private.sessions;
begin
  if username like '%@%' then
    -- It's an email
    select users.* into v_user
    from app_public.users
    inner join app_public.user_emails
    on (user_emails.user_id = users.id)
    where user_emails.email = login.username
    order by
      user_emails.is_verified desc, -- Prefer verified email
      user_emails.created_at asc -- Failing that, prefer the first registered (unverified users _should_ verify before logging in)
    limit 1;
  else
    -- It's a username
    select users.* into v_user
    from app_public.users
    where users.username = login.username;
  end if;

  if not (v_user is null) then
    -- Load their secrets
    select * into v_user_secret from app_private.user_secrets
    where user_secrets.user_id = v_user.id;

    -- Have there been too many login attempts?
    if (
      v_user_secret.first_failed_password_attempt is not null
    and
      v_user_secret.first_failed_password_attempt > NOW() - v_login_attempt_window_duration
    and
      v_user_secret.failed_password_attempts >= 3
    ) then
      raise exception 'User account locked - too many login attempts. Try again after 5 minutes.' using errcode = 'LOCKD';
    end if;

    -- Not too many login attempts, let's check the password.
    -- NOTE: `password_hash` could be null, this is fine since `NULL = NULL` is null, and null is falsy.
    if v_user_secret.password_hash = crypt(password, v_user_secret.password_hash) then
      if v_user_secret.password_reset_required then
        raise exception 'Please reset your password to continue signing in with it.' using errcode = 'PWRST';
      end if;
      -- Excellent - they're logged in! Let's reset the attempt tracking
      update app_private.user_secrets
      set failed_password_attempts = 0, first_failed_password_attempt = null, last_login_at = now()
      where user_id = v_user.id;
      -- Create a session for the user
      insert into app_private.sessions (user_id) values (v_user.id) returning * into v_session;
      -- And finally return the session
      return v_session;
    else
      -- Wrong password, bump all the attempt tracking figures
      update app_private.user_secrets
      set
        failed_password_attempts = (case when first_failed_password_attempt is null or first_failed_password_attempt < now() - v_login_attempt_window_duration then 1 else failed_password_attempts + 1 end),
        first_failed_password_attempt = (case when first_failed_password_attempt is null or first_failed_password_attempt < now() - v_login_attempt_window_duration then now() else first_failed_password_attempt end)
      where user_id = v_user.id;
      return null; -- Must not throw otherwise transaction will be aborted and attempts won't be recorded
    end if;
  else
    -- No user with that email/username was found
    return null;
  end if;
end;
$$ language plpgsql strict volatile;

-- The provider has proven ownership of the email, so hand the account to them
-- and revoke anything that whoever registered it could still use to get back in
create or replace function app_private.claim_unverified_account(f_user_id uuid, f_email citext) returns void as $$
begin
  update app_public.user_emails
    set is_verified = true, is_primary = true
    where user_id = f_user_id and email = f_email;

  update app_private.user_secrets
    set
      password_reset_required = password_hash is not null,
      reset_password_token = null,
      reset_password_token_generated = null,
      delete_account_token = null,
      delete_account_token_generated = null
    where user_id = f_user_id;

  delete from app_private.sessions where user_id = f_user_id;
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;

revoke all on function app_private.claim_unverified_account(uuid, citext) from public;

create or replace function app_private.link_or_register_user(f_user_id uuid, f_service character varying, f_identifier character varying, f_profile json, f_auth_details json) returns app_public.users as $$
declare
  v_matched_user_id uuid;
  v_matched_authentication_id uuid;
  v_email citext;
  v_email_verified boolean;
  v_name text;
  v_avatar_url text;
  v_user app_public.users;
  v_user_email app_public.user_emails;
  v_unverified_user_ids uuid[];
begin
  -- See if a user account already matches these details
  select id, user_id
    into v_matched_authentication_id, v_matched_user_id
    from app_public.user_authentications
    where service = f_service
    and identifier = f_identifier
    limit 1;

  if v_matched_user_id is not null and f_user_id is not null and v_matched_user_id <> f_user_id then
    raise exception 'A different user already has this account linked.' using errcode = 'TAKEN';
  end if;

  v_email = f_profile ->> 'email';
  v_email_verified = coalesce((f_profile ->> 'email_verified')::boolean, false);
  v_name := f_profile ->> 'name';
  v_avatar_url := f_profile ->> 'avatar_url';

  if v_matched_authentication_id is null then
    if f_user_id is not null then
      -- Link new account to logged in user account
      if not exists(select 1 from app_public.users where id = f_user_id and is_verified is true) then
        if v_email_verified and exists(
          select 1 from app_public.user_emails where user_id = f_user_id and email = v_email
        ) then
          update app_public.user_emails
            set is_verified = true, is_primary = true
            where user_id = f_user_id and email = v_email;
        else
          raise exception 'Please verify your email before connecting other sign in methods.' using errcode = 'VRFY3';
        end if;
      end if;
      v_matched_user_id = f_user_id;
    elsif v_email is not null and v_email_verified then
      -- See if the email is registered
      select * into v_user_email from app_public.user_emails where email = v_email and is_verified is true;
      if v_user_email is not null then
        -- User exists!
        v_matched_user_id = v_user_email.user_id;
      else
        select array_agg(distinct user_id) into v_unverified_user_ids
          from app_public.user_emails where email = v_email;
        if v_unverified_user_ids is not null then
          if array_length(v_unverified_user_ids, 1) > 1 or exists(
            select 1 from app_public.user_emails
              where user_id = v_unverified_user_ids[1] and (is_verified is true or email <> v_email)
          ) or exists(
            select 1 from app_public.user_authentications
              where user_id = v_unverified_user_ids[1]
          ) then
            raise exception 'An account with this email already exists. Sign in with your password, then connect this account from your settings.' using errcode = 'EMLNK';
          end if;
          perform app_private.claim_unverified_account(v_unverified_user_ids[1], v_email);
          v_matched_user_id = v_unverified_user_ids[1];
        end if;
      end if;
    end if;

    if v_matched_user_id is not null then
      insert into app_public.user_authentications (user_id, service, identifier, details) values
        (v_matched_user_id, f_service, f_identifier, f_profile) returning id into v_matched_authentication_id;
      insert into app_private.user_authentication_secrets (user_authentication_id, details) values
        (v_matched_authentication_id, f_auth_details);
      perform graphile_worker.add_job(
        'user__audit',
        json_build_object(
          'type', 'linked_account',
          'user_id', v_matched_user_id,
          'extra1', f_service,
          'extra2', f_identifier,
          'current_user_id', app_public.current_user_id()
        ));
    end if;
  end if;

  if v_matched_user_id is null then
    -- Create and return a new user account
    return app_private.register_user(f_service, f_identifier, f_profile, f_auth_details, v_email_verified);
  end if;

  update app_public.user_authentications
    set details = f_profile
    where id = v_matched_authentication_id;
  update app_private.user_authentication_secrets
    set details = f_auth_details
    where user_authentication_id = v_matched_authentication_id;
  update app_public.users
    set
      name = coalesce(users.name, v_name),
      avatar_url = coalesce(users.avatar_url, v_avatar_url)
    where id = v_matched_user_id
    returning * into v_user;
  return v_user;
end;
$$ language plpgsql volatile security definer set search_path = pg_catalog, public, pg_temp;
