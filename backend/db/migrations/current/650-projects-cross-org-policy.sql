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
