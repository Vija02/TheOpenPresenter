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

