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
