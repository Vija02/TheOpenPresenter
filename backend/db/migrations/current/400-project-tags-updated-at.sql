/*
 * Updates the specified project updated_at column
 */
create function app_private.tg_tasks__update_project_updated_at() returns trigger as $$
begin
  update app_public.projects
  set
    updated_at = now()
  where id = COALESCE(NEW.project_id, OLD.project_id);
  
  return null;
end;
$$ language plpgsql volatile security definer set search_path to pg_catalog, public, pg_temp;
comment on function app_private.tg_tasks__update_project_updated_at() is
  E'This trigger should be attached to all entity that is connected to a project. We use this to update the updated_at field in a project';

create trigger _300_update_project_updated_at after insert or update or delete on app_public.project_tags for each row execute procedure app_private.tg_tasks__update_project_updated_at();
