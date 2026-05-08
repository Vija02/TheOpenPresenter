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
