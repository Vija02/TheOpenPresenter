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
