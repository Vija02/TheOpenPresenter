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
