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
