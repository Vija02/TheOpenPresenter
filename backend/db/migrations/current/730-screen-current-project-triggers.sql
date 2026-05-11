create or replace function app_private.tg__delete_temp_project_on_unassign()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $$
begin
  if old.current_project_id is not null
     and new.current_project_id is distinct from old.current_project_id then
    delete from app_public.projects
    where id = old.current_project_id
      and is_temporary = true;
  end if;
  return null;
end;
$$;

drop trigger if exists _500_delete_temp_project_on_unassign on app_public.screens;
create trigger _500_delete_temp_project_on_unassign
  after update of current_project_id on app_public.screens
  for each row
  when (old.current_project_id is distinct from new.current_project_id)
  execute function app_private.tg__delete_temp_project_on_unassign();
