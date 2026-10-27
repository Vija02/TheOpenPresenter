select app_private.attach_cloud_sync_hints();

-- Projects: only what project sync compares. `updated_at` moves with every
-- document save, which the document bridge carries instead.
create trigger _900_cloud_sync_hint_insert
  after insert on app_public.projects
  for each row when (not NEW.is_temporary)
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_update
  after update on app_public.projects
  for each row when (
    (OLD.name, OLD.target_date, OLD.category_id, OLD.is_temporary)
      is distinct from
    (NEW.name, NEW.target_date, NEW.category_id, NEW.is_temporary)
  )
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_delete
  after delete on app_public.projects
  for each row when (not OLD.is_temporary)
  execute procedure app_private.tg__cloud_sync_hint('organization_id');

create trigger _900_cloud_sync_hint
  after insert or update or delete on app_public.project_tags
  for each row
  execute procedure app_private.tg__cloud_sync_hint('project_id', 'project');

-- Media: once an upload is complete, not on every chunk.
create trigger _900_cloud_sync_hint_insert
  after insert on app_public.medias
  for each row when (NEW.is_complete)
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_update
  after update on app_public.medias
  for each row when (
    (OLD.is_complete, OLD.media_name, OLD.original_name, OLD.tags)
      is distinct from
    (NEW.is_complete, NEW.media_name, NEW.original_name, NEW.tags)
    and NEW.is_complete
  )
  execute procedure app_private.tg__cloud_sync_hint('organization_id');
create trigger _900_cloud_sync_hint_delete
  after delete on app_public.medias
  for each row
  execute procedure app_private.tg__cloud_sync_hint('organization_id');

create trigger _900_cloud_sync_hint
  after insert or delete on app_public.project_medias
  for each row
  execute procedure app_private.tg__cloud_sync_hint('project_id', 'project');
