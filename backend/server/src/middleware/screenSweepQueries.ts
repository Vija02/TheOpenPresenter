// Delete active controllers & unassign project from screen when idle and is set to unassign
export const SWEEP_IDLE_UNASSIGN_SQL = `
  with eligible as (
    select s.id as screen_id
    from app_public.screens s
    join app_public.screen_heartbeats h on h.screen_id = s.id
    where s.idle_policy = 'unassign'
      and s.current_project_id is not null
      -- Synced screens may be in use through the cloud, which sweeps them.
      and not exists (
        select 1 from app_public.cloud_connections cc
        where cc.organization_id = s.organization_id
      )
      and s.idle_after_seconds is not null
      and s.idle_after_seconds > 0
      and s.unassign_after_idle_seconds is not null
      and s.unassign_after_idle_seconds >= 0
      and greatest(
        h.last_seen_by_guest_at,
        h.last_seen_by_admin_at
      ) < now() - make_interval(
        secs => s.idle_after_seconds + s.unassign_after_idle_seconds
      )
  ),
  released_seats as (
    delete from app_public.screen_active_controllers ac
    where ac.screen_id in (select screen_id from eligible)
    returning ac.screen_id
  )
  update app_public.screens s
  set current_project_id = null
  where s.id in (select screen_id from eligible)
  returning s.id;
`;
