--! Previous: sha1:0bf092cb755d48ab98698ba70d685d4971082499
--! Hash: sha1:a347c6f9a0f4e994e24a6170c8ff55c7d5fa0c9c

--! split: 100-reset.sql
-- Drops everything the rest of this migration creates, in reverse-dependency
-- order, so the whole batch is re-runnable.

drop function if exists app_public.set_email_subscription_by_token(text, app_public.email_category, boolean);
drop function if exists app_public.set_my_email_subscription(app_public.email_category, boolean);
drop function if exists app_private.user_wants_email(uuid, app_public.email_category);
drop function if exists app_private.set_email_subscription(uuid, app_public.email_category, boolean);
drop table if exists app_public.user_email_preferences cascade;
alter table app_private.user_secrets drop column if exists email_unsubscribe_token;
drop type if exists app_public.email_category cascade;

--! split: 200-enums.sql
-- (drops live in 100-reset.sql)

-- Kinds of optional (non-account) email a user can opt out of. Account emails
-- (verification, password reset, invites...) are never covered by this.
create type app_public.email_category as enum (
  'onboarding'
);
comment on type app_public.email_category is 'Kinds of optional email a user can unsubscribe from.';

--! split: 300-email-preferences.sql
-- (drops live in 100-reset.sql)

-- One row per (user, category) the user has explicitly set. No row means the
-- default, which is subscribed.
create table app_public.user_email_preferences (
  user_id uuid not null references app_public.users on delete cascade,
  category app_public.email_category not null,
  subscribed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table app_public.user_email_preferences enable row level security;

create trigger _100_timestamps
  before insert or update on app_public.user_email_preferences
  for each row execute procedure app_private.tg__timestamps();

comment on table app_public.user_email_preferences is 'Optional email categories a user has opted in or out of. A missing row means subscribed.';
comment on column app_public.user_email_preferences.subscribed is 'Whether the user wants to receive emails in this category.';

create policy select_own on app_public.user_email_preferences
  for select using (user_id = app_public.current_user_id());

-- Writes only go through the functions in 900-email-preference-functions.sql
grant select on app_public.user_email_preferences to :DATABASE_VISITOR;

-- Secret used in unsubscribe links so people can opt out without logging in.
-- The volatile default gives every existing user their own token.
alter table app_private.user_secrets
  add column email_unsubscribe_token text not null default encode(gen_random_bytes(18), 'hex');
create unique index on app_private.user_secrets (email_unsubscribe_token);

--! split: 900-email-preference-functions.sql
create function app_private.set_email_subscription(
  p_user_id uuid,
  p_category app_public.email_category,
  p_subscribed boolean
) returns void as $$
  insert into app_public.user_email_preferences (user_id, category, subscribed)
  values (p_user_id, p_category, p_subscribed)
  on conflict (user_id, category) do update
    set subscribed = excluded.subscribed;
$$ language sql volatile security definer set search_path to pg_catalog, public, pg_temp;

-- Used by the worker before sending any optional email.
create function app_private.user_wants_email(
  p_user_id uuid,
  p_category app_public.email_category
) returns boolean as $$
  select coalesce(
    (select subscribed from app_public.user_email_preferences
      where user_id = p_user_id and category = p_category),
    true
  );
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

-- Settings page: change your own preference.
create function app_public.set_my_email_subscription(
  category app_public.email_category,
  subscribed boolean
) returns app_public.user_email_preferences as $$
declare
  v_user_id uuid := app_public.current_user_id();
  v_result app_public.user_email_preferences;
begin
  if v_user_id is null then
    raise exception 'You must log in to change your email preferences' using errcode = 'LOGIN';
  end if;

  perform app_private.set_email_subscription(v_user_id, category, subscribed);

  select * into v_result from app_public.user_email_preferences p
    where p.user_id = v_user_id and p.category = set_my_email_subscription.category;
  return v_result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;
comment on function app_public.set_my_email_subscription(app_public.email_category, boolean) is 'Subscribe or unsubscribe the current user from a category of optional email.';

-- Unsubscribe link in emails: works without logging in. Returns false if the
-- token doesn't match anyone.
create function app_public.set_email_subscription_by_token(
  token text,
  category app_public.email_category,
  subscribed boolean
) returns boolean as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
    from app_private.user_secrets
    where email_unsubscribe_token = token;

  if v_user_id is null then
    return false;
  end if;

  perform app_private.set_email_subscription(v_user_id, category, subscribed);
  return true;
end;
$$ language plpgsql volatile strict security definer set search_path to pg_catalog, public, pg_temp;
comment on function app_public.set_email_subscription_by_token(text, app_public.email_category, boolean) is E'@resultFieldName success\nSubscribe or unsubscribe using the link from an email, without logging in.';
