create function app_public.current_screen_guest_session()
  returns app_public.screen_guest_sessions as $$
  select s.* from app_public.screen_guest_sessions s
  where s.id = app_public.current_screen_guest_session_id();
$$ language sql stable;
