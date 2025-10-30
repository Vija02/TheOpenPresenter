alter table app_public.projects drop constraint projects_category_id_fkey;

ALTER TABLE ONLY app_public.projects
  ADD CONSTRAINT projects_category_id_fkey FOREIGN KEY (category_id) REFERENCES app_public.categories(id) ON DELETE SET NULL;
