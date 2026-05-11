-- 750 (create-temporary-project.sql)
drop function if exists app_public.create_temporary_project(uuid) cascade;

-- 730 (screen-current-project-triggers.sql)
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