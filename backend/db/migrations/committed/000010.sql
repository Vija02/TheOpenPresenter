--! Previous: sha1:27b3ab3df76031047dd7d9ca4d2af15ed7909a92
--! Hash: sha1:2f60909a7fca08ef4414f392d63c4b2fde5be413

--! split: 1-current.sql
drop index if exists projects_target_date_idx;

create index on "app_public"."projects"("target_date");
