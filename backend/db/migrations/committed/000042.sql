--! Previous: sha1:0bc6a61676c4fdb6f6180529c36f1851696adeb2
--! Hash: sha1:90643e965e0330547efd88bde358ebe91d02163c

--! split: 1-current.sql
-- Enter migration here

--! split: 100-client-plugin-fk-index.sql
drop index if exists app_public.client_plugins_latest_version_id_idx;

create index client_plugins_latest_version_id_idx
  on app_public.client_plugins(latest_version_id);
