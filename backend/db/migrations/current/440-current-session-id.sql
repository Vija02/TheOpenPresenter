create function app_public.current_screen_guest_session_id() returns uuid as $$
  select nullif(current_setting('jwt.claims.screen_guest_session_id', true), '')::uuid;
$$ language sql stable;
