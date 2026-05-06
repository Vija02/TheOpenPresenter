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

