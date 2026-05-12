--! Previous: sha1:b79d240154b65f496a921d2326b2b6bd8af6c6c3
--! Hash: sha1:54ab7358a5100eb551740a6f38ae91992f17f649

--! split: 100-reset.sql
-- 750 (create-temporary-project.sql)
drop function if exists app_public.create_temporary_project(uuid) cascade;

-- 730 (screen-current-project-triggers.sql)
drop trigger if exists _500_delete_temp_project_on_screen_delete on app_public.screens;
drop trigger if exists _500_delete_temp_project_on_unassign on app_public.screens;
drop function if exists app_private.tg__delete_temp_project_on_unassign() cascade;

-- 720 (screen-functions.sql)
drop function if exists app_public.ping_screen_control(uuid) cascade;
drop function if exists app_public.release_screen_control(uuid) cascade;

-- 700 (control-functions.sql)
drop function if exists app_public.set_existing_project_to_screen(uuid, uuid) cascade;
drop function if exists app_private.current_session_can_control_screen(uuid) cascade;

-- 650 (projects-cross-org-policy.sql)
drop policy if exists select_as_screen_current_for_org_member on app_public.projects;
drop policy if exists select_as_screen_current_for_guest_seat on app_public.projects;

-- 600 (screen-guest-access-policies.sql)
drop policy if exists select_for_guest_session on app_public.organizations;
drop policy if exists select_for_guest_session on app_public.screens;

-- 510 (screen-control-requests.sql)
drop function if exists app_private.tg__notify_org_screen_control_request() cascade;
drop table if exists app_public.screen_control_requests cascade;
drop type if exists app_public.screen_control_request_status cascade;
drop type if exists app_public.screen_control_request_type cascade;

-- 500 (screen-active-controllers.sql)
drop table if exists app_public.screen_active_controllers cascade;

-- 480 (guest-login.sql)
drop function if exists app_private.authenticate_screen_guest(uuid, text) cascade;
drop function if exists app_public.screen_login_metadata(text, text) cascade;
drop type if exists app_public.screen_login_info cascade;

-- 460 (current-session-functions.sql)
drop function if exists app_public.current_screen_guest_session() cascade;

-- 450 (screen-guest-sessions.sql)
drop table if exists app_public.screen_guest_sessions cascade;

-- 440 (current-session-id.sql)
drop function if exists app_public.current_screen_guest_session_id() cascade;

-- 410 (screen-guest-admin-functions.sql)
drop function if exists app_public.delete_screen_guest(uuid) cascade;
drop function if exists app_public.update_screen_guest(uuid, text, text, text, boolean) cascade;
drop function if exists app_public.create_screen_guest(uuid, text, text, text) cascade;

-- 400 (screen-guests.sql)
drop table if exists app_public.screen_guests cascade;

-- 360 (medias-tags-column.sql)
drop index if exists app_public.medias_tags_gin_idx;
alter table app_public.medias
  drop column if exists tags;

-- 350 (projects-temporary-column.sql)
drop index if exists app_public.projects_is_temporary_idx;
alter table app_public.projects
  drop column if exists is_temporary;

-- 300 (screens-access-columns.sql)
alter table app_public.screens
  drop column if exists registered_guest_enabled,
  drop column if exists registered_guest_on_empty_policy,
  drop column if exists registered_guest_on_takeover_policy,
  drop column if exists registered_guest_on_takeover_after_seconds,
  drop column if exists anon_guest_enabled,
  drop column if exists anon_guest_on_empty_policy,
  drop column if exists anon_guest_on_takeover_policy,
  drop column if exists anon_guest_on_takeover_after_seconds,
  drop column if exists idle_policy,
  drop column if exists idle_after_seconds,
  drop column if exists unassign_after_idle_seconds,
  drop column if exists show_bar_on_idle;

-- 200 (enums.sql)
drop type if exists app_public.screen_on_empty_policy cascade;
drop type if exists app_public.screen_on_takeover_policy cascade;
drop type if exists app_public.screen_idle_policy cascade;
drop type if exists app_public.screen_guest_session_kind cascade;

--! split: 200-enums.sql
create type app_public.screen_on_empty_policy as enum (
  'allow',
  'request'
);
create type app_public.screen_on_takeover_policy as enum (
  'allow',
  'request',
  'timer'
);
create type app_public.screen_idle_policy as enum (
  'do_nothing',
  'unassign'
);

create type app_public.screen_guest_session_kind as enum (
  'anon',
  'registered'
);

--! split: 300-screens-access-columns.sql
alter table app_public.screens
  add column registered_guest_enabled boolean not null default false,
  add column registered_guest_on_empty_policy app_public.screen_on_empty_policy not null default 'request',
  add column registered_guest_on_takeover_policy app_public.screen_on_takeover_policy not null default 'request',
  add column registered_guest_on_takeover_after_seconds integer,
  add column anon_guest_enabled boolean not null default false,
  add column anon_guest_on_empty_policy app_public.screen_on_empty_policy not null default 'request',
  add column anon_guest_on_takeover_policy app_public.screen_on_takeover_policy not null default 'request',
  add column anon_guest_on_takeover_after_seconds integer,
  add column idle_policy app_public.screen_idle_policy not null default 'do_nothing',
  add column idle_after_seconds integer,
  add column unassign_after_idle_seconds integer,
  add column show_bar_on_idle boolean not null default false;

grant update(
  registered_guest_enabled,
  registered_guest_on_empty_policy,
  registered_guest_on_takeover_policy,
  registered_guest_on_takeover_after_seconds,
  anon_guest_enabled,
  anon_guest_on_empty_policy,
  anon_guest_on_takeover_policy,
  anon_guest_on_takeover_after_seconds,
  idle_policy,
  idle_after_seconds,
  unassign_after_idle_seconds,
  show_bar_on_idle
) on app_public.screens to :DATABASE_VISITOR;

comment on column app_public.screens.registered_guest_enabled is
  E'Master switch for the registered-guest path on this screen. When false, registered guests cannot sign in or claim control regardless of the on_empty/on_takeover policies.';
comment on column app_public.screens.registered_guest_on_empty_policy is
  E'Registered guests claiming a vacant seat (consulted only when registered_guest_enabled = true). allow | request.';
comment on column app_public.screens.registered_guest_on_takeover_policy is
  E'Registered guests requesting control while another session holds the seat (consulted only when registered_guest_enabled = true). allow | request | timer.';
comment on column app_public.screens.registered_guest_on_takeover_after_seconds is
  E'For registered_guest_on_takeover_policy = ''timer'', how many seconds the active controller has to respond before the takeover is auto-granted.';
comment on column app_public.screens.anon_guest_enabled is
  E'Master switch for the anonymous-guest path on this screen. When false, anonymous guests cannot sign in or claim control regardless of the on_empty/on_takeover policies.';
comment on column app_public.screens.anon_guest_on_empty_policy is
  E'Anonymous guests claiming a vacant seat (consulted only when anon_guest_enabled = true). allow | request.';
comment on column app_public.screens.anon_guest_on_takeover_policy is
  E'Anonymous guests requesting control while another session holds the seat (consulted only when anon_guest_enabled = true). allow | request | timer.';
comment on column app_public.screens.anon_guest_on_takeover_after_seconds is
  E'For anon_guest_on_takeover_policy = ''timer'', how many seconds the active controller has to respond before the takeover is auto-granted.';
comment on column app_public.screens.idle_policy is
  E'What happens to the active controller seat when it stops sending input. do_nothing | unassign.';
comment on column app_public.screens.idle_after_seconds is
  E'Seconds from last input after which the seat is considered idle.';
comment on column app_public.screens.unassign_after_idle_seconds is
  E'Additional seconds after the seat becomes idle before it is auto-unassigned. Only consulted when idle_policy = ''unassign''.';
comment on column app_public.screens.show_bar_on_idle is
  E'When true, the renderer overlays an idle indicator bar once the seat is past idle_after_seconds.';

--! split: 350-projects-temporary-column.sql
alter table app_public.projects
  add column if not exists is_temporary boolean not null default false;

comment on column app_public.projects.is_temporary is
  E'True when this project was created up by a screen guest user';

create index if not exists projects_is_temporary_idx
  on app_public.projects(is_temporary);

--! split: 360-medias-tags-column.sql
alter table app_public.medias
  add column if not exists tags text[] not null default '{}';

create index if not exists medias_tags_gin_idx
  on app_public.medias using gin (tags);

--! split: 400-screen-guests.sql
create table app_public.screen_guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references app_public.organizations(id) on delete cascade,

  display_name text not null,
  email text,
  passcode_hash text not null,

  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references app_public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.screen_guests (organization_id);
create index on app_public.screen_guests (created_by);

create index on app_public.screen_guests (display_name);
create index on app_public.screen_guests (created_at);

create unique index screen_guests_org_email_uniq_idx
  on app_public.screen_guests (organization_id, lower(email))
  where email is not null;

/*====================================*/
/*========= Standard Triggers ========*/
/*====================================*/
-- Timestamps
create trigger _100_timestamps
  before insert or update on app_public.screen_guests
  for each row
  execute procedure app_private.tg__timestamps();

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.screen_guests enable row level security;
-- Policies
create policy select_member on app_public.screen_guests
  for select using (organization_id in (select app_public.current_user_member_organization_ids()));
-- Everything else goes through function since we need to hash passcode

-- Grants
grant select on app_public.screen_guests to :DATABASE_VISITOR;

comment on table app_public.screen_guests is
  E'Registered guest identities scoped to an organization.';
comment on column app_public.screen_guests.passcode_hash is
  E'@omit';

--! split: 410-screen-guest-admin-functions.sql
create function app_public.create_screen_guest(
  organization_id uuid,
  display_name text,
  passcode text,
  email text default null
) returns app_public.screen_guests as $$
#variable_conflict use_variable
declare
  result app_public.screen_guests;
  v_user_id uuid := app_public.current_user_id();
begin
  if v_user_id is null
     or organization_id not in (select app_public.current_user_member_organization_ids())
  then
    raise exception 'You must be a member of the organization to manage guest access' using errcode = 'NACES';
  end if;

  if length(coalesce(passcode, '')) < 4 then
    raise exception 'Passcode must be at least 4 characters' using errcode = 'BADPC';
  end if;

  insert into app_public.screen_guests
    (organization_id, display_name, email, passcode_hash, created_by)
  values
    (organization_id, display_name, nullif(email, ''), crypt(passcode, gen_salt('bf')), v_user_id)
  returning * into result;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.create_screen_guest(uuid, text, text, text) to :DATABASE_VISITOR;

create function app_public.update_screen_guest(
  id uuid,
  display_name text default null,
  passcode text default null,
  email text default null,
  is_active boolean default null
) returns app_public.screen_guests as $$
#variable_conflict use_variable
declare
  result app_public.screen_guests;
  v_user_id uuid := app_public.current_user_id();
  v_entry app_public.screen_guests;
begin
  select sg.* into v_entry
  from app_public.screen_guests sg
  where sg.id = id;

  if v_entry is null then
    raise exception 'Screen guest not found' using errcode = 'NTFND';
  end if;
  if v_user_id is null
     or v_entry.organization_id not in (select app_public.current_user_member_organization_ids())
  then
    raise exception 'You must be a member of the organization to manage guest access' using errcode = 'NACES';
  end if;

  if passcode is not null and length(passcode) < 4 then
    raise exception 'Passcode must be at least 4 characters' using errcode = 'BADPC';
  end if;

  update app_public.screen_guests sg
  set display_name = coalesce(display_name, sg.display_name),
      email = case when email is null then sg.email else nullif(email, '') end,
      passcode_hash = case when passcode is null then sg.passcode_hash else crypt(passcode, gen_salt('bf')) end,
      is_active = coalesce(is_active, sg.is_active),
      updated_at = now()
  where sg.id = id
  returning sg.* into result;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.update_screen_guest(uuid, text, text, text, boolean) to :DATABASE_VISITOR;

create function app_public.delete_screen_guest(id uuid) returns uuid as $$
#variable_conflict use_variable
declare
  v_user_id uuid := app_public.current_user_id();
  v_entry app_public.screen_guests;
begin
  select sg.* into v_entry
  from app_public.screen_guests sg
  where sg.id = id;
  if v_entry is null then
    return id;
  end if;
  if v_user_id is null
     or v_entry.organization_id not in (select app_public.current_user_member_organization_ids())
  then
    raise exception 'You must be a member of the organization to manage guest access' using errcode = 'NACES';
  end if;

  delete from app_public.screen_guests sg where sg.id = id;
  return id;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.delete_screen_guest(uuid) to :DATABASE_VISITOR;

--! split: 440-current-session-id.sql
create function app_public.current_screen_guest_session_id() returns uuid as $$
  select nullif(current_setting('jwt.claims.screen_guest_session_id', true), '')::uuid;
$$ language sql stable;

--! split: 450-screen-guest-sessions.sql
create table app_public.screen_guest_sessions (
  id uuid primary key default gen_random_uuid(),
  
  screen_id uuid not null references app_public.screens(id) on delete cascade,
  organization_id uuid not null references app_public.organizations(id) on delete cascade,
  screen_guest_id uuid references app_public.screen_guests(id) on delete set null,

  display_name text,
  kind app_public.screen_guest_session_kind not null,
  
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',

  created_at timestamptz not null default now()
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create unique index on app_public.screen_guest_sessions (screen_id, screen_guest_id)
  where screen_guest_id is not null;
  
create index on app_public.screen_guest_sessions (screen_id);
create index on app_public.screen_guest_sessions (organization_id);
create index on app_public.screen_guest_sessions (screen_guest_id);

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.screen_guest_sessions enable row level security;

create policy select_self on app_public.screen_guest_sessions
  for select using (id = app_public.current_screen_guest_session_id());
create policy select_member on app_public.screen_guest_sessions
  for select using (organization_id in (select app_public.current_user_member_organization_ids()));

-- Grants
grant select on app_public.screen_guest_sessions to :DATABASE_VISITOR;

/*====================================*/
/*============= TRIGGERS =============*/
/*====================================*/
create trigger _500_gql_notify_last_seen
  after update of last_seen_at on app_public.screen_guest_sessions
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'screenActiveControllerUpdate',
    'graphql:scr_ctl:$1',
    'screen_id'
  );

--! split: 460-current-session-functions.sql
create function app_public.current_screen_guest_session()
  returns app_public.screen_guest_sessions as $$
  select s.* from app_public.screen_guest_sessions s
  where s.id = app_public.current_screen_guest_session_id();
$$ language sql stable;

--! split: 480-guest-login.sql
create type app_public.screen_login_info as (
  organization_id uuid,
  organization_name text,
  organization_slug text,
  screen_id uuid,
  screen_name text,
  screen_slug text,
  allows_anon boolean,
  allows_registered boolean
);

create function app_public.screen_login_metadata(
  p_org_slug text,
  p_screen_slug text
) returns app_public.screen_login_info as $$
  select
    o.id,
    o.name,
    o.slug,
    s.id,
    s.name,
    s.slug,
    s.anon_guest_enabled as allows_anon,
    s.registered_guest_enabled as allows_registered
  from app_public.screens s
  join app_public.organizations o on o.id = s.organization_id
  where o.slug = p_org_slug
    and s.slug = p_screen_slug
    and (s.anon_guest_enabled or s.registered_guest_enabled);
$$ language sql stable security definer set search_path = pg_catalog, public, pg_temp;

grant execute on function app_public.screen_login_metadata(text, text) to :DATABASE_VISITOR;

comment on function app_public.screen_login_metadata(text, text) is
  E'Get the data required to login as guest.';

create function app_private.authenticate_screen_guest(
  p_screen_id uuid,
  p_secret text
) returns app_public.screen_guest_sessions as $$
declare
  v_screen app_public.screens;
  v_entry app_public.screen_guests;
  v_session app_public.screen_guest_sessions;
begin
  select * into v_screen
  from app_public.screens
  where id = p_screen_id;

  if v_screen is null then
    raise exception 'Screen not found' using errcode = 'NTFND';
  end if;

  if not v_screen.registered_guest_enabled then
    raise exception 'This screen does not accept registered guests' using errcode = 'DENID';
  end if;

  -- Try passcode first (stronger credential).
  select * into v_entry
  from app_public.screen_guests
  where organization_id = v_screen.organization_id
    and is_active
    and (expires_at is null or expires_at > now())
    and passcode_hash = crypt(p_secret, passcode_hash)
  limit 1;

  if v_entry is null and coalesce(p_secret, '') <> '' then
    select * into v_entry
    from app_public.screen_guests
    where organization_id = v_screen.organization_id
      and is_active
      and (expires_at is null or expires_at > now())
      and email is not null
      and lower(email) = lower(p_secret)
    limit 1;
  end if;

  if v_entry is null then
    raise exception 'Unrecognized email or passcode' using errcode = 'CREDS';
  end if;

  insert into app_public.screen_guest_sessions
    (screen_id, organization_id, kind, display_name, screen_guest_id)
  values
    (p_screen_id, v_screen.organization_id, 'registered', v_entry.display_name, v_entry.id)
  on conflict (screen_id, screen_guest_id) where screen_guest_id is not null
  do update set
    display_name = excluded.display_name,
    last_seen_at = now()
  returning * into v_session;

  return v_session;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

--! split: 500-screen-active-controllers.sql
create table app_public.screen_active_controllers (
  screen_id uuid primary key references app_public.screens(id) on delete cascade,
  -- This will duplicate screen_id. Used because some of our code expects "id" (tg__graphql_subscription)
  id uuid generated always as (screen_id) stored,

  screen_guest_session_id uuid not null references app_public.screen_guest_sessions(id) on delete cascade,

  acquired_at timestamptz not null default now(),
  expires_at timestamptz
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.screen_active_controllers (screen_guest_session_id);

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.screen_active_controllers enable row level security;

create policy select_guest_session on app_public.screen_active_controllers
  for select using (screen_guest_session_id = app_public.current_screen_guest_session_id());
-- Any guest of the same screen can see who currently holds the seat.
-- So that we know what behaviour to do
create policy select_same_screen_guest on app_public.screen_active_controllers
  for select using (
    screen_id = (app_public.current_screen_guest_session()).screen_id
  );
create policy select_own on app_public.screen_active_controllers
  for select using (
    screen_id in (
      select id from app_public.screens where organization_id in (select app_public.current_user_member_organization_ids())
    )
  );

-- Grants
grant select on app_public.screen_active_controllers to :DATABASE_VISITOR;

/*====================================*/
/*============= TRIGGERS =============*/
/*====================================*/
create trigger _500_gql_notify
  after insert or update or delete on app_public.screen_active_controllers
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'screenActiveControllerUpdate',
    'graphql:scr_ctl:$1',
    'screen_id'
  );

--! split: 510-screen-control-requests.sql
create type app_public.screen_control_request_type as enum (
  'acquire',
  'takeover'
);
create type app_public.screen_control_request_status as enum (
  'pending',
  'approved',
  'denied'
);

create table app_public.screen_control_requests (
  id uuid primary key default gen_random_uuid(),

  screen_id uuid not null references app_public.screens(id) on delete cascade,
  screen_guest_session_id uuid not null references app_public.screen_guest_sessions(id) on delete cascade,

  request_type app_public.screen_control_request_type not null,
  status app_public.screen_control_request_status not null default 'pending',
  note text,

  resolved_by_user_id uuid references app_public.users(id) on delete set null,
  resolved_at timestamptz,

  created_at timestamptz not null default now()
);

/*====================================*/
/*============== Indexes =============*/
/*====================================*/
create index on app_public.screen_control_requests (screen_id);
create index on app_public.screen_control_requests (screen_guest_session_id);
create index on app_public.screen_control_requests (resolved_by_user_id);
create index on app_public.screen_control_requests (status);
create index on app_public.screen_control_requests (created_at);

/*====================================*/
/*================ RLS ===============*/
/*====================================*/
alter table app_public.screen_control_requests enable row level security;

create policy select_guest_session on app_public.screen_control_requests
  for select using (screen_guest_session_id = app_public.current_screen_guest_session_id());
create policy select_own on app_public.screen_control_requests
  for select using (
    screen_id in (
      select id from app_public.screens where organization_id in (select app_public.current_user_member_organization_ids())
    )
  );

-- Grants
grant select on app_public.screen_control_requests to :DATABASE_VISITOR;

/*====================================*/
/*============= TRIGGERS =============*/
/*====================================*/
create trigger _510_gql_notify
  after insert or update or delete on app_public.screen_control_requests
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'screenControlRequestUpdate',
    'graphql:scr_req:$1',
    'id'
  );

create trigger _511_gql_per_screen_notify
  after insert or update or delete on app_public.screen_control_requests
  for each row
  execute procedure app_public.tg__graphql_subscription(
    'screenControlRequestsUpdate',
    'graphql:scr_reqs:$1',
    'screen_id'
  );

-- Per-organization notify
create or replace function app_private.tg__notify_org_screen_control_request()
  returns trigger
  security definer
  set search_path to pg_catalog, public, pg_temp
  language plpgsql
as $$
declare
  v_record record;
  v_org_id uuid;
begin
  if (TG_OP = 'DELETE') then
    v_record := OLD;
  else
    v_record := NEW;
  end if;
  select organization_id
    into v_org_id
    from app_public.screens
    where id = v_record.screen_id;
  if v_org_id is not null then
    perform pg_notify(
      'graphql:org_scr_reqs:' || v_org_id::text,
      json_build_object(
        'event', 'organizationPendingScreenControlRequestsUpdate',
        'subject', v_record.id,
        'id', v_record.id
      )::text
    );
  end if;
  return v_record;
end;
$$;

create trigger _512_gql_per_org_notify
  after insert or update or delete on app_public.screen_control_requests
  for each row
  execute procedure app_private.tg__notify_org_screen_control_request();

--! split: 600-screen-guest-access-policies.sql
drop policy if exists select_for_guest_session on app_public.screens;
create policy select_for_guest_session on app_public.screens
  for select using (
    id = (app_public.current_screen_guest_session()).screen_id
  );

drop policy if exists select_for_guest_session on app_public.organizations;
create policy select_for_guest_session on app_public.organizations
  for select using (
    id = (app_public.current_screen_guest_session()).organization_id
  );

--! split: 650-projects-cross-org-policy.sql
create policy select_as_screen_current_for_org_member on app_public.projects
  for select using (
    exists (
      select 1
      from app_public.screens s
      where s.current_project_id = projects.id
        and s.organization_id in (
          -- Access for members of the screen's org
          select app_public.current_user_member_organization_ids()
        )
    )
  );

create policy select_as_screen_current_for_guest_seat on app_public.projects
  for select using (
    exists (
      select 1
      from app_public.screens s
      join app_public.screen_active_controllers ac on ac.screen_id = s.id
      where s.current_project_id = projects.id
        -- Access only for the guest who currently holds the seat
        and ac.screen_guest_session_id = app_public.current_screen_guest_session_id()
    )
  );

--! split: 700-control-functions.sql
create function app_private.current_session_can_control_screen(p_screen_id uuid) returns boolean as $$
  select
    exists(
      select 1 from app_public.screens s
      where s.id = p_screen_id
        and s.organization_id in (select app_public.current_user_member_organization_ids())
    )
    or
    exists(
      select 1 from app_public.screen_active_controllers ac
      where ac.screen_id = p_screen_id
        and ac.screen_guest_session_id = app_public.current_screen_guest_session_id()
    );
$$ language sql stable security definer set search_path to pg_catalog, public, pg_temp;

create function app_public.set_existing_project_to_screen(
  screen_id uuid,
  project_id uuid default null
) returns app_public.screens as $$
declare
  result app_public.screens;
begin
  if not app_private.current_session_can_control_screen(screen_id) then
    raise exception 'You do not have control of this screen' using errcode = 'NACES';
  end if;

  if project_id is not null then
    if not exists (
      select 1
      from app_public.screens s, app_public.projects p
      where s.id = screen_id
        and p.id = project_id
        and (
          p.organization_id = s.organization_id
          or p.organization_id in (select app_public.current_user_member_organization_ids())
          or p.is_public is true
        )
    ) then
      raise exception 'Project not accessible' using errcode = 'NTFND';
    end if;
  end if;

  update app_public.screens
  set current_project_id = project_id
  where id = screen_id
  returning * into result;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.set_existing_project_to_screen(uuid, uuid) to :DATABASE_VISITOR;

--! split: 720-screen-functions.sql
create function app_public.release_screen_control(
  screen_id uuid
) returns app_public.screens as $$
declare
  result app_public.screens;
  guest_id uuid;
begin
  if not app_private.current_session_can_control_screen(screen_id) then
    raise exception 'You do not have control of this screen' using errcode = 'NACES';
  end if;

  -- Remove active controller
  delete from app_public.screen_active_controllers ac
  where ac.screen_id = release_screen_control.screen_id
  returning ac.screen_guest_session_id into guest_id;

  if guest_id is not null then
    -- Revoke session too
    delete from app_public.screen_guest_sessions where id = guest_id;
  end if;
  
  update app_public.screens
  set current_project_id = null
  where id = release_screen_control.screen_id
  returning * into result;

  if not found then
    raise exception 'Screen not found' using errcode = 'NTFND';
  end if;

  return result;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.release_screen_control(uuid) to :DATABASE_VISITOR;

--! split: 730-screen-current-project-triggers.sql
create or replace function app_private.tg__delete_temp_project_on_unassign()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $$
declare
  prev_project_id uuid;
begin
  if tg_op = 'UPDATE' then
    if old.current_project_id is not null
       and new.current_project_id is distinct from old.current_project_id then
      prev_project_id := old.current_project_id;
    end if;
  elsif tg_op = 'DELETE' then
    prev_project_id := old.current_project_id;
  end if;

  if prev_project_id is not null then
    delete from app_public.projects
    where id = prev_project_id
      and is_temporary = true;
  end if;

  return null;
end;
$$;

drop trigger if exists _500_delete_temp_project_on_unassign on app_public.screens;
create trigger _500_delete_temp_project_on_unassign
  after update of current_project_id on app_public.screens
  for each row
  when (old.current_project_id is distinct from new.current_project_id)
  execute function app_private.tg__delete_temp_project_on_unassign();

drop trigger if exists _500_delete_temp_project_on_screen_delete on app_public.screens;
create trigger _500_delete_temp_project_on_screen_delete
  after delete on app_public.screens
  for each row
  when (old.current_project_id is not null)
  execute function app_private.tg__delete_temp_project_on_unassign();

--! split: 750-create-temporary-project.sql
create function app_public.create_temporary_project(
  screen_id uuid
) returns app_public.projects as $$
declare
  v_screen app_public.screens;
  v_project app_public.projects;
  v_slug text;
begin
  if not app_private.current_session_can_control_screen(screen_id) then
    raise exception 'You do not have control of this screen' using errcode = 'NACES';
  end if;

  select * into v_screen from app_public.screens where id = screen_id;
  if v_screen.id is null then
    raise exception 'Screen not found' using errcode = 'NTFND';
  end if;

  v_slug := 'temp-' || replace(gen_random_uuid()::text, '-', '');

  insert into app_public.projects (
    organization_id,
    creator_user_id,
    name,
    slug,
    is_temporary
  ) values (
    v_screen.organization_id,
    app_public.current_user_id(),
    'Temporary project',
    v_slug,
    true
  ) returning * into v_project;

  update app_public.screens
  set current_project_id = v_project.id
  where id = screen_id;

  return v_project;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;

grant execute on function app_public.create_temporary_project(uuid) to :DATABASE_VISITOR;
